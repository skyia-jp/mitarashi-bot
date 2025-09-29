import prisma from '../client.js';

export function findGameBias(guildId, userId, gameType) {
  return prisma.gameBias.findUnique({
    where: {
      guildId_userId_gameType: {
        guildId,
        userId,
        gameType
      }
    }
  });
}

export async function ensureGameBias(guildId, userId, gameType) {
  const existing = await findGameBias(guildId, userId, gameType);
  if (existing) {
    return existing;
  }

  return prisma.gameBias.create({
    data: {
      guildId,
      userId,
      gameType
    }
  });
}

export function resetGameBias(guildId, userId, gameType) {
  return prisma.gameBias.upsert({
    where: {
      guildId_userId_gameType: {
        guildId,
        userId,
        gameType
      }
    },
    create: {
      guildId,
      userId,
      gameType,
      lossCount: 0
    },
    update: {
      lossCount: 0
    }
  });
}

export function incrementGameBiasLoss(guildId, userId, gameType) {
  return prisma.gameBias.upsert({
    where: {
      guildId_userId_gameType: {
        guildId,
        userId,
        gameType
      }
    },
    create: {
      guildId,
      userId,
      gameType,
      lossCount: 1
    },
    update: {
      lossCount: {
        increment: 1
      }
    }
  });
}
