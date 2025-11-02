import prisma from '../client.js';

export function createWarning(data: any) {
  return prisma.warning.create({ data });
}

export function listWarnings(guildId: string, userId: string) {
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

export function clearWarnings(guildId: string, userId: string) {
  return prisma.warning.deleteMany({
    where: {
      guildId,
      user: {
        discordId: userId
      }
    }
  });
}

export function logAction(data: any) {
  return prisma.moderationAction.create({ data });
}

export function listActions(guildId: string, targetDiscordId: string, limit = 10) {
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

export function getWarningTotals(guildId: string, userId: string) {
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
