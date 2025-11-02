import {
  createPinnedMessage,
  deletePinnedMessage,
  findPinnedMessageByChannel,
  listPinnedMessages,
  findPinnedMessageByMessageIds,
  updatePinnedMessage
} from '../database/repositories/pinnedMessageRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';
import { Message, TextChannel, Attachment, Snowflake, Interaction } from 'discord.js';
import type { PinnedMessage } from '@prisma/client';

function snapshotMessage(message: Message) {
  const embeds = message.embeds?.length ? message.embeds.map((embed) => embed.toJSON()) : null;
  const files = message.attachments?.size
    ? Array.from(message.attachments.values()).map((attachment: Attachment) => ({
        url: attachment.url,
        name: attachment.name
      }))
    : null;

  return {
    content: message.content ?? null,
    embeds,
    files
  } as {
    content: string | null;
    embeds: any[] | null;
    files: { url: string; name?: string | null }[] | null;
  };
}

function buildMessagePayload(snapshot: { content?: string | null; embeds?: any[] | null; files?: { url: string; name?: string | null }[] | null }): import('discord.js').MessageCreateOptions {
  const payload: import('discord.js').MessageCreateOptions = {
    content: snapshot.content ?? undefined,
    embeds: snapshot.embeds ?? undefined,
    // empty parse array to prevent mentions
    allowedMentions: { parse: [] as unknown as readonly import('discord.js').MessageMentionTypes[] }
  };

  if (snapshot.files?.length) {
    payload.files = snapshot.files.map((file) => ({ attachment: file.url, name: file.name }));
  }

  return payload;
}

async function removeExistingClone(channel: TextChannel, record: PinnedMessage | any) {
  const cloneId = (record?.cloneMessageId ?? record?.messageId) as Snowflake | undefined | null;
  if (!cloneId) return;
  const existing = await channel.messages.fetch(cloneId).catch(() => null);
  if (existing) {
    await existing.delete().catch(() => null);
  }
}

export async function pinMessage(interaction: Interaction, message: Message, expiresAt: string | null = null) {
  const user = await getOrCreateUser(interaction.user);
  const channel = message.channel as TextChannel;

  const snapshot = snapshotMessage(message);
  const currentRecord = (await findPinnedMessageByChannel(interaction.guildId, channel.id)) as PinnedMessage | null;
  if (currentRecord) {
    await removeExistingClone(channel, currentRecord);
  }

  const MAX_SNAPSHOT_CHARS = 65500;
  if (snapshot.content && snapshot.content.length > MAX_SNAPSHOT_CHARS) {
    snapshot.content = snapshot.content.slice(0, MAX_SNAPSHOT_CHARS) + '\n\n...[truncated]';
  }

  const clone = await channel.send(buildMessagePayload(snapshot) as import('discord.js').MessageCreateOptions);

  if (currentRecord) {
    // currentRecord.id is a number (Prisma generated type); repository.update expects number
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

export async function unpinMessage(interaction: Interaction, message: Message | { id: string; channel: TextChannel }) {
  const channel = (message as { channel: TextChannel }).channel;
  const msgId = (message as { id: string }).id;
  const record = (await findPinnedMessageByMessageIds(interaction.guildId, channel.id, msgId)) as PinnedMessage | null;

  if (!record) {
    throw new Error('Pinned message not found');
  }

  await removeExistingClone(channel, record);
  await deletePinnedMessage(record.id);
  return record;
}

export async function unpinAllInChannel(interaction: Interaction, channel: TextChannel) {
  const all = (await listPinnedMessages(interaction.guildId as string)) as PinnedMessage[];
  const channelRecords = all.filter((r) => r.channelId === channel.id);
  let count = 0;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const record of channelRecords) {
    try {
      const cloneId = record.cloneMessageId ?? record.messageId;
      if (cloneId) {
        const existing = await channel.messages.fetch(cloneId).catch(() => null);
        if (existing) {
          await existing.delete().catch(() => null);
          await sleep(150);
        }
      }
    } catch (err) {
      // ignore
    }

    try {
      await deletePinnedMessage(record.id);
      count += 1;
    } catch (err) {
      // ignore
    }
  }

  return count;
}

export async function refreshPinnedMessagePosition(channel: TextChannel) {
  const record = (await findPinnedMessageByChannel(channel.guild.id, channel.id)) as PinnedMessage | null;
  if (!record) return;

  if (!record.snapshotContent && !record.snapshotEmbeds && !record.snapshotFiles) return;

  await removeExistingClone(channel, record);

  const embeds = Array.isArray(record.snapshotEmbeds) ? (record.snapshotEmbeds as any[]) : undefined;
  const files = Array.isArray(record.snapshotFiles)
    ? (record.snapshotFiles as { url: string; name?: string | null }[])
    : undefined;

  const clone = await channel.send(
    buildMessagePayload({
      content: record.snapshotContent as string | null | undefined,
      embeds,
      files
    }) as import('discord.js').MessageCreateOptions
  );

  await updatePinnedMessage(record.id, {
    messageId: clone.id,
    cloneMessageId: clone.id
  });

  return clone;
}
