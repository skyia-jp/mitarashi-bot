import prisma from '../client.js';

export function createWarning(data) {
  return prisma.warning.create({ data });
}

export function listWarnings(guildId, userId) {
  return prisma.warning.findMany({
    where: {
      guildId,
      user: {
        discordId: userId
      }
    },
    include: {
      moderator: {
        select: {
          discordId: true,
          username: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export function clearWarnings(guildId, userId) {
  return prisma.warning.deleteMany({
    where: {
      guildId,
      user: {
        discordId: userId
      }
    }
  });
}

export function logAction(data) {
  return prisma.moderationAction.create({ data });
}

export function listActions(guildId, targetDiscordId, limit = 10) {
  return prisma.moderationAction.findMany({
    where: {
      guildId,
      targetUser: {
        discordId: targetDiscordId
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

export function getWarningTotals(guildId, userId) {
  return prisma.warning.aggregate({
    where: {
      guildId,
      user: {
        discordId: userId
      }
    },
    _sum: {
      penaltyLevel: true
    },
    _count: {
      _all: true
    }
  });
}
