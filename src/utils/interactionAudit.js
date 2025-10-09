import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import { createLogger } from './logger.js';

const auditLogger = createLogger({ module: 'discord-audit' });

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID?.trim() || null;
const LOG_WEBHOOK_URL = process.env.LOG_DISCORD_WEBHOOK_URL?.trim() || null;

let cachedChannel = null;
let cachedClientId = null;

const STATUS_METADATA = {
  success: {
    color: 0x4caf50,
    emoji: '✅',
    title: 'Slash Command Executed'
  },
  failure: {
    color: 0xf44336,
    emoji: '❌',
    title: 'Slash Command Failed'
  },
  warning: {
    color: 0xffc107,
    emoji: '⚠️',
    title: 'Slash Command Warning'
  }
};

function stringifyValue(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value.length > 100 ? `${value.slice(0, 97)}…` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function collectOptions(options = [], acc = []) {
  for (const option of options) {
    if (!option) continue;

    if (
      option.type === ApplicationCommandOptionType.Subcommand ||
      option.type === ApplicationCommandOptionType.SubcommandGroup
    ) {
      collectOptions(option.options ?? [], acc);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(option, 'value')) {
      acc.push({
        name: option.name,
        value: stringifyValue(option.value)
      });
    }
  }

  return acc;
}

async function resolveLogChannel(client) {
  if (!LOG_CHANNEL_ID) {
    return null;
  }

  if (cachedChannel && cachedChannel.id === LOG_CHANNEL_ID && cachedClientId === client.user?.id) {
    return cachedChannel;
  }

  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      auditLogger.warn(
        {
          event: 'audit.channel.unavailable',
          channel_id: LOG_CHANNEL_ID,
          channel_type: channel?.type
        },
        'Log channel is not text-based or unavailable'
      );
      return null;
    }

    cachedChannel = channel;
    cachedClientId = client.user?.id ?? null;
    return channel;
  } catch (error) {
    auditLogger.warn(
      {
        err: error,
        event: 'audit.channel.fetch.error',
        channel_id: LOG_CHANNEL_ID
      },
      'Failed to fetch log channel'
    );
    return null;
  }
}

function buildCommandEmbed(interaction, status, { durationMs, error, subcommandGroup, subcommand }) {
  const metadata = STATUS_METADATA[status] ?? STATUS_METADATA.warning;

  const baseDescription = `/${interaction.commandName}`;
  const commandPath = [subcommandGroup, subcommand].filter(Boolean).join(' ');

  const embed = new EmbedBuilder()
    .setColor(metadata.color)
    .setTitle(`${metadata.emoji} ${metadata.title}`)
    .setDescription(commandPath ? `${baseDescription} ${commandPath}` : baseDescription)
    .setTimestamp()
    .setFooter({ text: `Interaction ID: ${interaction.id}` });

  const guildName = interaction.guild?.name ?? 'Direct Message';
  const guildId = interaction.guild?.id ?? 'dm';
  const channelName = interaction.channel?.name ?? 'Direct Message';
  const channelId = interaction.channel?.id ?? 'dm';

  embed.addFields(
    {
      name: 'User',
      value: interaction.user
        ? `${interaction.user.tag} (${interaction.user.id})`
        : 'Unknown',
      inline: true
    },
    {
      name: 'Guild',
      value: `${guildName} (${guildId})`,
      inline: true
    },
    {
      name: 'Channel',
      value: `${channelName} (${channelId})`,
      inline: true
    }
  );

  const options = collectOptions(interaction.options?.data ?? []);
  if (options.length) {
    const optionLines = options
      .slice(0, 10)
      .map((option) => `• ${option.name}: ${option.value}`)
      .join('\n');

    embed.addFields({
      name: 'Options',
      value: optionLines.length > 1024 ? `${optionLines.slice(0, 1021)}…` : optionLines,
      inline: false
    });
  }

  if (typeof durationMs === 'number') {
    embed.addFields({
      name: 'Duration',
      value: `${durationMs} ms`,
      inline: true
    });
  }

  if (status === 'failure' && error) {
    const message = error instanceof Error ? error.message : String(error);
    embed.addFields({
      name: 'Error',
      value: message.length > 1024 ? `${message.slice(0, 1021)}…` : message,
      inline: false
    });
  }

  return embed;
}

function postJson(urlString, payload) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const body = JSON.stringify(payload);
      const isHttps = url.protocol === 'https:';
      const requester = isHttps ? httpsRequest : httpRequest;

      const req = requester(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              statusMessage: res.statusMessage ?? '',
              body: Buffer.concat(chunks).toString()
            });
          });
        }
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function sendEmbedToWebhook(embedJson, status) {
  if (!LOG_WEBHOOK_URL) {
    return false;
  }

  try {
    const response = await postJson(LOG_WEBHOOK_URL, {
      username: 'Mitarashi Logger',
      embeds: [embedJson],
      allowed_mentions: {
        parse: []
      },
      ...(status === 'failure'
        ? {
            content: '❌ Slash command failed'
          }
        : {})
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      auditLogger.warn(
        {
          event: 'audit.webhook.post.failed',
          status_code: response.statusCode,
          status_text: response.statusMessage
        },
        'Failed to post interaction audit to Discord webhook'
      );
      return false;
    }

    return true;
  } catch (error) {
    auditLogger.warn(
      {
        err: error,
        event: 'audit.webhook.post.error'
      },
      'Failed to post interaction audit to Discord webhook'
    );
    return false;
  }
}

export async function recordSlashCommandOutcome(interaction, result) {
  if (!interaction?.client) {
    return;
  }

  const embed = buildCommandEmbed(interaction, result.status, result);
  const embedJson = embed.toJSON();

  const destinations = [];

  const channel = await resolveLogChannel(interaction.client);
  if (channel) {
    destinations.push(
      channel.send({ embeds: [embed] }).catch((error) => {
        auditLogger.warn(
          {
            err: error,
            event: 'audit.channel.post.error',
            channel_id: channel?.id
          },
          'Failed to send interaction audit log to channel'
        );
      })
    );
  }

  if (LOG_WEBHOOK_URL) {
    destinations.push(sendEmbedToWebhook(embedJson, result.status));
  }

  if (!destinations.length) {
  auditLogger.debug({ event: 'audit.destination.missing' }, 'No audit log destination configured');
    return;
  }

  await Promise.allSettled(destinations);
}

export default {
  recordSlashCommandOutcome
};
