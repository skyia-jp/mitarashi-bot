import { ensureGameBias, incrementGameBiasLoss, resetGameBias } from '../database/repositories/gameBiasRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

const BASE_WIN_RATE = 0.5;
const LOSS_INCREMENT = 0.08;
const MAX_WIN_RATE = 0.75;
const MAX_REROLL_CHANCE = 0.5;

export function calculateWinRate(lossCount) {
  return Math.min(BASE_WIN_RATE + LOSS_INCREMENT * lossCount, MAX_WIN_RATE);
}

export async function prepareGameBias(interaction, gameType) {
  const userRecord = await getOrCreateUser(interaction.user);
  const biasRecord = await ensureGameBias(interaction.guildId, userRecord.id, gameType);
  const winRate = calculateWinRate(biasRecord.lossCount);
  const rerollChance = Math.min(Math.max(winRate - BASE_WIN_RATE, 0) * 2, MAX_REROLL_CHANCE);

  return {
    userRecord,
    biasRecord,
    winRate,
    rerollChance
  };
}

export async function recordGameOutcome(interaction, gameType, userRecord, outcome) {
  const user = userRecord ?? (await getOrCreateUser(interaction.user));

  if (outcome === 'player') {
    await resetGameBias(interaction.guildId, user.id, gameType);
  } else if (outcome === 'dealer') {
    await incrementGameBiasLoss(interaction.guildId, user.id, gameType);
  }
}

export const gameBiasConfig = {
  baseWinRate: BASE_WIN_RATE,
  lossIncrement: LOSS_INCREMENT,
  maxWinRate: MAX_WIN_RATE,
  maxRerollChance: MAX_REROLL_CHANCE
};
