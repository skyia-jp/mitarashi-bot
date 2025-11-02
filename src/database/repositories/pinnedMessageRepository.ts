import prisma from '../client.js';
import type { Prisma, PinnedMessage } from '@prisma/client';

export async function createPinnedMessage(
  data: Prisma.PinnedMessageCreateInput | Prisma.PinnedMessageUncheckedCreateInput
) {
  return prisma.pinnedMessage.create({ data });
}

export async function updatePinnedMessage(
  id: number,
  data: Prisma.PinnedMessageUpdateInput | Prisma.PinnedMessageUncheckedUpdateInput
) {
  return prisma.pinnedMessage.update({
    where: { id },
    data
  });
}

export async function deletePinnedMessage(id: number) {
  return prisma.pinnedMessage.delete({ where: { id } });
}

export async function findPinnedMessageByChannel(guildId: string, channelId: string): Promise<PinnedMessage | null> {
  return prisma.pinnedMessage.findFirst({
    where: {
      guildId,
      channelId
    }
  });
}

export async function findPinnedMessageByMessageIds(
  guildId: string,
  channelId: string,
  messageId: string
): Promise<PinnedMessage | null> {
  return prisma.pinnedMessage.findFirst({
    where: {
      guildId,
      channelId,
      OR: [{ sourceMessageId: messageId }, { cloneMessageId: messageId }, { messageId }]
    }
  });
}

export async function listPinnedMessages(guildId: string): Promise<PinnedMessage[]> {
  return prisma.pinnedMessage.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' }
  });
}
