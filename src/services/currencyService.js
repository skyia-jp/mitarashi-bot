import { randomInt } from 'node:crypto';
import prisma from '../database/client.js';
import {
  createTransaction,
  findBalanceByGuildAndUser,
  findLatestTransactionByType,
  updateBalanceById,
  upsertBalance
} from '../database/repositories/currencyRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

export const TRANSACTION_TYPES = {
  EARN: 'EARN',
  SPEND: 'SPEND',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  ADJUST: 'ADJUST',
  GAME_BET: 'GAME_BET',
  GAME_WIN: 'GAME_WIN',
  DAILY_BONUS: 'DAILY_BONUS'
};

const DAILY_MIN_REWARD = 50;
const DAILY_MAX_REWARD = 150;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export class CurrencyError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = 'CurrencyError';
    this.code = code;
    this.context = context;
  }
}

function resolveGuildContext(guild) {
  if (typeof guild === 'string') {
    return { id: guild, name: null };
  }

  if (guild && typeof guild === 'object') {
    if (typeof guild.id === 'string') {
      return { id: guild.id, name: guild.name ?? null };
    }

    if (typeof guild.guildId === 'string') {
      return { id: guild.guildId, name: guild.guild?.name ?? null };
    }
  }

  throw new CurrencyError('MISSING_GUILD', 'ギルド情報が必要です。');
}

async function ensureGuildRecord(guild, transaction) {
  const client = transaction ?? prisma;
  const context = resolveGuildContext(guild);

  const existing = await client.guild.findUnique({ where: { id: context.id } });

  if (!existing) {
    await client.guild.create({
      data: {
        id: context.id,
        name: context.name
      }
    });
  } else if (context.name && existing.name !== context.name) {
    await client.guild.update({
      where: { id: context.id },
      data: { name: context.name }
    });
  }

  return context;
}

function assertPositiveAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CurrencyError('INVALID_AMOUNT', '金額は正の数で指定してください。', { amount });
  }
}

async function getOrCreateBalance(guildId, userId, transaction) {
  const balance = await findBalanceByGuildAndUser(guildId, userId, transaction);
  if (balance) {
    return balance;
  }
  return upsertBalance(guildId, userId, transaction);
}

async function adjustBalance(guild, discordUser, delta, type, { reason, metadata } = {}) {
  if (!Number.isFinite(delta) || delta === 0) {
    return getBalance(guild, discordUser);
  }

  return prisma.$transaction(async (tx) => {
    const guildContext = await ensureGuildRecord(guild, tx);
    const userRecord = await getOrCreateUser(discordUser, tx);
    const balance = await getOrCreateBalance(guildContext.id, userRecord.id, tx);
    const nextBalance = balance.balance + delta;

    if (nextBalance < 0) {
      throw new CurrencyError('INSUFFICIENT_FUNDS', '残高が不足しています。', {
        current: balance.balance,
        required: Math.abs(delta)
      });
    }

    const updated = await updateBalanceById(balance.id, nextBalance, tx);
    await createTransaction(
      {
        guildId: guildContext.id,
        userId: userRecord.id,
        balanceId: updated.id,
        type,
        amount: delta,
        balanceAfter: updated.balance,
        reason,
        metadata: metadata ?? null
      },
      tx
    );

    return { guildId: guildContext.id, user: userRecord, balance: updated };
  });
}

export async function getBalance(guild, discordUser) {
  const guildContext = await ensureGuildRecord(guild);
  const userRecord = await getOrCreateUser(discordUser);
  const balance = await getOrCreateBalance(guildContext.id, userRecord.id);
  return { guildId: guildContext.id, user: userRecord, balance };
}

export async function credit(guild, discordUser, amount, options = {}) {
  assertPositiveAmount(amount);
  const { type = TRANSACTION_TYPES.EARN } = options;
  return adjustBalance(guild, discordUser, amount, type, options);
}

export async function debit(guild, discordUser, amount, options = {}) {
  assertPositiveAmount(amount);
  const { type = TRANSACTION_TYPES.SPEND } = options;
  return adjustBalance(guild, discordUser, -amount, type, options);
}

export async function transfer(guild, fromUser, toUser, amount, { reason, metadata } = {}) {
  assertPositiveAmount(amount);

  if (fromUser.id === toUser.id) {
    throw new CurrencyError('INVALID_TARGET', '自身に送金することはできません。');
  }

  return prisma.$transaction(async (tx) => {
    const guildContext = await ensureGuildRecord(guild, tx);
    const sender = await getOrCreateUser(fromUser, tx);
    const recipient = await getOrCreateUser(toUser, tx);

    const senderBalance = await getOrCreateBalance(guildContext.id, sender.id, tx);
    if (senderBalance.balance < amount) {
      throw new CurrencyError('INSUFFICIENT_FUNDS', '残高が不足しています。', {
        current: senderBalance.balance,
        required: amount
      });
    }

    const updatedSender = await updateBalanceById(senderBalance.id, senderBalance.balance - amount, tx);
    await createTransaction(
      {
        guildId: guildContext.id,
        userId: sender.id,
        balanceId: updatedSender.id,
        type: TRANSACTION_TYPES.TRANSFER_OUT,
        amount: -amount,
        balanceAfter: updatedSender.balance,
        reason,
        metadata: {
          ...(metadata ?? {}),
          to: recipient.discordId
        }
      },
      tx
    );

    const recipientBalance = await getOrCreateBalance(guildContext.id, recipient.id, tx);
    const updatedRecipient = await updateBalanceById(recipientBalance.id, recipientBalance.balance + amount, tx);
    await createTransaction(
      {
        guildId: guildContext.id,
        userId: recipient.id,
        balanceId: updatedRecipient.id,
        type: TRANSACTION_TYPES.TRANSFER_IN,
        amount,
        balanceAfter: updatedRecipient.balance,
        reason,
        metadata: {
          ...(metadata ?? {}),
          from: sender.discordId
        }
      },
      tx
    );

    return {
      sender: { user: sender, balance: updatedSender },
      recipient: { user: recipient, balance: updatedRecipient }
    };
  });
}

export async function claimDaily(guild, discordUser) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const guildContext = await ensureGuildRecord(guild, tx);
    const userRecord = await getOrCreateUser(discordUser, tx);
    const lastClaim = await findLatestTransactionByType(
      guildContext.id,
      userRecord.id,
      TRANSACTION_TYPES.DAILY_BONUS,
      tx
    );

    if (lastClaim) {
      const elapsed = now.getTime() - new Date(lastClaim.createdAt).getTime();
      if (elapsed < DAILY_COOLDOWN_MS) {
        const retryAt = new Date(lastClaim.createdAt).getTime() + DAILY_COOLDOWN_MS;
        throw new CurrencyError('COOLDOWN_ACTIVE', 'デイリーボーナスはまだ受け取れません。', {
          retryAt: new Date(retryAt)
        });
      }
    }

    const reward = DAILY_MIN_REWARD + randomInt(DAILY_MAX_REWARD - DAILY_MIN_REWARD + 1);
    const balance = await getOrCreateBalance(guildContext.id, userRecord.id, tx);
    const updated = await updateBalanceById(balance.id, balance.balance + reward, tx);

    await createTransaction(
      {
        guildId: guildContext.id,
        userId: userRecord.id,
        balanceId: updated.id,
        type: TRANSACTION_TYPES.DAILY_BONUS,
        amount: reward,
        balanceAfter: updated.balance,
        reason: 'デイリーボーナス'
      },
      tx
    );

    return {
      user: userRecord,
      reward,
      balance: updated,
      nextClaimAt: new Date(now.getTime() + DAILY_COOLDOWN_MS)
    };
  });
}

export function getCooldownInfo(error) {
  if (error instanceof CurrencyError && error.code === 'COOLDOWN_ACTIVE') {
    return error.context;
  }
  return null;
}

export async function placeBet(guild, discordUser, amount, metadata) {
  return debit(guild, discordUser, amount, {
    type: TRANSACTION_TYPES.GAME_BET,
    reason: 'ゲームのベット',
    metadata
  });
}

export async function payoutWin(guild, discordUser, amount, metadata) {
  return credit(guild, discordUser, amount, {
    type: TRANSACTION_TYPES.GAME_WIN,
    reason: 'ゲーム勝利報酬',
    metadata
  });
}

export async function adjustBalanceManually(guild, discordUser, amount, { reason, metadata } = {}) {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new CurrencyError('INVALID_AMOUNT', '調整額は0ではない値を指定してください。', { amount });
  }

  const type = TRANSACTION_TYPES.ADJUST;
  return adjustBalance(guild, discordUser, amount, type, { reason, metadata });
}
