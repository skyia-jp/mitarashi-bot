import prisma from '../client.js';

export function createPinnedMessage(data) {
  return prisma.pinnedMessage.create({ data });
}

export function updatePinnedMessage(id, data) {
  return prisma.pinnedMessage.update({
    where: { id },
    data
  });
}

export function deletePinnedMessage(id) {
  return prisma.pinnedMessage.delete({ where: { id } });
}

export function findPinnedMessageByChannel(guildId, channelId) {
  return prisma.pinnedMessage.findFirst({
    where: {
      guildId,
      channelId
    }
  });
}

export function findPinnedMessageByMessageIds(guildId, channelId, messageId) {
  return prisma.pinnedMessage.findFirst({
    where: {
      guildId,
      channelId,
      OR: [
        { sourceMessageId: messageId },
        { cloneMessageId: messageId },
        { messageId }
      ]
    }
  });
}

export function listPinnedMessages(guildId) {
  return prisma.pinnedMessage.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' }
  });
}
