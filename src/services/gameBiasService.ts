import { ensureGameBias, incrementGameBiasLoss, resetGameBias } from '../database/repositories/gameBiasRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { GameBias, User as PrismaUser } from '@prisma/client';

const BASE_WIN_RATE = 0.5;
const LOSS_INCREMENT = 0.08;
const MAX_WIN_RATE = 0.75;
const MAX_REROLL_CHANCE = 0.5;

export function calculateWinRate(lossCount: number) {
  return Math.min(BASE_WIN_RATE + LOSS_INCREMENT * lossCount, MAX_WIN_RATE);
}

export async function prepareGameBias(interaction: ChatInputCommandInteraction, gameType: string) {
  const userRecord = await getOrCreateUser(interaction.user as any) as PrismaUser;
  const biasRecord = await ensureGameBias(interaction.guildId as string, userRecord.id, gameType) as GameBias;
  const winRate = calculateWinRate(biasRecord.lossCount);
  const rerollChance = Math.min(Math.max(winRate - BASE_WIN_RATE, 0) * 2, MAX_REROLL_CHANCE);

  return {
    userRecord,
    biasRecord,
    winRate,
    rerollChance
  };
}

export async function recordGameOutcome(
  interaction: ChatInputCommandInteraction,
  gameType: string,
  userRecord: PrismaUser | null | undefined,
  outcome: 'player' | 'dealer' | string
) {
  const user = userRecord ?? (await getOrCreateUser(interaction.user as any) as PrismaUser);

  if (outcome === 'player') {
    await resetGameBias(interaction.guildId as string, user.id, gameType);
  } else if (outcome === 'dealer') {
    await incrementGameBiasLoss(interaction.guildId as string, user.id, gameType);
  }
}

export const gameBiasConfig = {
  baseWinRate: BASE_WIN_RATE,
  lossIncrement: LOSS_INCREMENT,
  maxWinRate: MAX_WIN_RATE,
  maxRerollChance: MAX_REROLL_CHANCE
};
