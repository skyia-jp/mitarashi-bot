import prisma from '../client.js';
import type { GameBias } from '@prisma/client';

export function findGameBias(guildId: string, userId: number, gameType: string): Promise<GameBias | null> {
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

export async function ensureGameBias(guildId: string, userId: number, gameType: string): Promise<GameBias> {
  const existing = await findGameBias(guildId, userId, gameType);
  if (existing) return existing;

  return prisma.gameBias.create({
    data: {
      guildId,
      userId,
      gameType
    }
  });
}

export function resetGameBias(guildId: string, userId: number, gameType: string) {
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

export function incrementGameBiasLoss(guildId: string, userId: number, gameType: string) {
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
