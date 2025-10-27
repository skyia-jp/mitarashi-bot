import {
  createPinnedMessage,
  deletePinnedMessage,
  findPinnedMessageByChannel,
  findPinnedMessageByMessageIds,
  updatePinnedMessage
} from '../database/repositories/pinnedMessageRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

function snapshotMessage(message) {
  const embeds = message.embeds?.length ? message.embeds.map((embed) => embed.toJSON()) : null;
  const files = message.attachments?.size
    ? Array.from(message.attachments.values()).map((attachment) => ({
        url: attachment.url,
        name: attachment.name
      }))
    : null;

  return {
    content: message.content ?? null,
    embeds,
    files
  };
}

function buildMessagePayload(snapshot) {
  const payload = {
    content: snapshot.content ?? undefined,
    embeds: snapshot.embeds ?? undefined,
    allowedMentions: { parse: [] }
  };

  if (snapshot.files?.length) {
    payload.files = snapshot.files.map((file) => ({ attachment: file.url, name: file.name }));
  }

  return payload;
}

async function removeExistingClone(channel, record) {
  const cloneId = record.cloneMessageId ?? record.messageId;
  if (!cloneId) return;
  const existing = await channel.messages.fetch(cloneId).catch(() => null);
  if (existing) {
    await existing.delete().catch(() => null);
  }
}

export async function pinMessage(interaction, message, expiresAt = null) {
  const user = await getOrCreateUser(interaction.user);
  const channel = message.channel;

  const snapshot = snapshotMessage(message);
  const currentRecord = await findPinnedMessageByChannel(interaction.guildId, channel.id);
  if (currentRecord) {
    await removeExistingClone(channel, currentRecord);
  }

  // Truncate snapshot content to avoid DB column overflow in case of unexpectedly long content
  const MAX_SNAPSHOT_CHARS = 65500; // conservative for LONGTEXT and multibyte
  if (snapshot.content && snapshot.content.length > MAX_SNAPSHOT_CHARS) {
    snapshot.content = snapshot.content.slice(0, MAX_SNAPSHOT_CHARS) + '\n\n...[truncated]';
  }

  const clone = await channel.send(buildMessagePayload(snapshot));

  if (currentRecord) {
    await updatePinnedMessage(currentRecord.id, {
      messageId: clone.id,
      cloneMessageId: clone.id,
      sourceMessageId: message.id,
      snapshotContent: snapshot.content,
      snapshotEmbeds: snapshot.embeds,
      snapshotFiles: snapshot.files,
      pinnedById: user.id,
      expiresAt
    });
    return clone;
  }

  await createPinnedMessage({
    guildId: interaction.guildId,
    channelId: channel.id,
    messageId: clone.id,
    cloneMessageId: clone.id,
    sourceMessageId: message.id,
    snapshotContent: snapshot.content,
    snapshotEmbeds: snapshot.embeds,
    snapshotFiles: snapshot.files,
    pinnedById: user.id,
    expiresAt
  });

  return clone;
}

export async function unpinMessage(interaction, message) {
  const channel = message.channel;
  const record = await findPinnedMessageByMessageIds(
    interaction.guildId,
    channel.id,
    message.id
  );

  if (!record) {
    throw new Error('Pinned message not found');
  }

  await removeExistingClone(channel, record);
  await deletePinnedMessage(record.id);
  return record;
}

export async function unpinAllInChannel(interaction, channel) {
  // Remove all pinned records for this guild+channel
  const all = await listPinnedMessages(interaction.guildId);
  const channelRecords = all.filter((r) => r.channelId === channel.id);
  let count = 0;
  for (const record of channelRecords) {
    // attempt to remove clone message if exists
    try {
      const cloneId = record.cloneMessageId ?? record.messageId;
      if (cloneId) {
        const existing = await channel.messages.fetch(cloneId).catch(() => null);
        if (existing) {
          await existing.delete().catch(() => null);
        }
      }
    } catch (err) {
      // ignore errors per-record
    }

    try {
      await deletePinnedMessage(record.id);
      count += 1;
    } catch (err) {
      // ignore delete errors
    }
  }

  return count;
}

export async function refreshPinnedMessagePosition(channel) {
  const record = await findPinnedMessageByChannel(channel.guild.id, channel.id);
  if (!record) return;

  // Avoid refreshing if the record lacks snapshot data
  if (!record.snapshotContent && !record.snapshotEmbeds && !record.snapshotFiles) return;

  await removeExistingClone(channel, record);

  const clone = await channel.send(
    buildMessagePayload({
      content: record.snapshotContent,
      embeds: record.snapshotEmbeds,
      files: record.snapshotFiles
    })
  );

  await updatePinnedMessage(record.id, {
    messageId: clone.id,
    cloneMessageId: clone.id
  });

  return clone;
}
