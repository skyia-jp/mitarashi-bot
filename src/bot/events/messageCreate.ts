import type { Client, Message } from 'discord.js';
import { refreshPinnedMessagePosition } from '../../services/pinService.js';
import { recordMessageActivity } from '../../services/activityService.js';
import { createModuleLogger } from '../../utils/logger.js';

const logger = createModuleLogger('events:messageCreate');

export default {
  name: 'messageCreate',
  async execute(client: Client, message: Message) {
    if (!message.guild || message.author?.bot || message.webhookId || message.system) return;

    if (message.partial) {
      try {
        await message.fetch();
      } catch (err) {
        logger.warn({ err }, 'Failed to fetch partial message');
        return;
      }
    }

    // keep using the runtime JS service import path (with .js) so ESM resolution works at runtime
    // message.channel can be multiple channel types; cast to TextChannel for the service which accepts TextChannel
    refreshPinnedMessagePosition(message.channel as import('discord.js').TextChannel).catch((err) => {
      logger.debug({ err }, 'refreshPinnedMessagePosition error');
    });

    // 全メッセージのアクティビティを記録
    recordMessageActivity(message.guild.id, message.author.id).catch((err) => {
      logger.error({ err }, 'recordMessageActivity failed');
    });

    const botId = client.user?.id;
    const isBotMention = Boolean(botId && message.mentions?.users?.has && message.mentions.users.has(botId));

  const prefix = client.config?.prefix ?? process.env.COMMAND_PREFIX ?? '!';
    const content = typeof message.content === 'string' ? message.content.trimStart() : '';
    const isCommand = content.startsWith(prefix);

    if (!isBotMention && !isCommand) return;
  }
};
