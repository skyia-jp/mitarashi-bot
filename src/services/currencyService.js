import { randomInt } from 'node:crypto';
import prisma from '../database/client.js';
import { createTransaction, findBalanceByUserId, findLatestTransactionByType, updateBalanceById, upsertBalance } from '../database/repositories/currencyRepository.js';
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

function assertPositiveAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CurrencyError('INVALID_AMOUNT', '金額は正の数で指定してください。', { amount });
  }
}

async function getOrCreateBalance(userId, transaction) {
  const balance = await findBalanceByUserId(userId, transaction);
  if (balance) {
    return balance;
  }
  return upsertBalance(userId, transaction);
}

async function adjustBalance(discordUser, delta, type, { reason, metadata } = {}) {
  if (!Number.isFinite(delta) || delta === 0) {
    return getBalance(discordUser);
  }

  return prisma.$transaction(async (tx) => {
    const userRecord = await getOrCreateUser(discordUser, tx);
    const balance = await getOrCreateBalance(userRecord.id, tx);
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

    return { user: userRecord, balance: updated };
  });
}

export async function getBalance(discordUser) {
  const userRecord = await getOrCreateUser(discordUser);
  const balance = await getOrCreateBalance(userRecord.id);
  return { user: userRecord, balance };
}

export async function credit(discordUser, amount, options = {}) {
  assertPositiveAmount(amount);
  const { type = TRANSACTION_TYPES.EARN } = options;
  return adjustBalance(discordUser, amount, type, options);
}

export async function debit(discordUser, amount, options = {}) {
  assertPositiveAmount(amount);
  const { type = TRANSACTION_TYPES.SPEND } = options;
  return adjustBalance(discordUser, -amount, type, options);
}

export async function transfer(fromUser, toUser, amount, { reason, metadata } = {}) {
  assertPositiveAmount(amount);

  if (fromUser.id === toUser.id) {
    throw new CurrencyError('INVALID_TARGET', '自身に送金することはできません。');
  }

  return prisma.$transaction(async (tx) => {
    const sender = await getOrCreateUser(fromUser, tx);
    const recipient = await getOrCreateUser(toUser, tx);

    const senderBalance = await getOrCreateBalance(sender.id, tx);
    if (senderBalance.balance < amount) {
      throw new CurrencyError('INSUFFICIENT_FUNDS', '残高が不足しています。', {
        current: senderBalance.balance,
        required: amount
      });
    }

    const updatedSender = await updateBalanceById(senderBalance.id, senderBalance.balance - amount, tx);
    await createTransaction(
      {
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

    const recipientBalance = await getOrCreateBalance(recipient.id, tx);
    const updatedRecipient = await updateBalanceById(recipientBalance.id, recipientBalance.balance + amount, tx);
    await createTransaction(
      {
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

export async function claimDaily(discordUser) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const userRecord = await getOrCreateUser(discordUser, tx);
    const lastClaim = await findLatestTransactionByType(
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
    const balance = await getOrCreateBalance(userRecord.id, tx);
    const updated = await updateBalanceById(balance.id, balance.balance + reward, tx);

    await createTransaction(
      {
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

export async function placeBet(discordUser, amount, metadata) {
  return debit(discordUser, amount, {
    type: TRANSACTION_TYPES.GAME_BET,
    reason: 'ゲームのベット',
    metadata
  });
}

export async function payoutWin(discordUser, amount, metadata) {
  return credit(discordUser, amount, {
    type: TRANSACTION_TYPES.GAME_WIN,
    reason: 'ゲーム勝利報酬',
    metadata
  });
}

export async function adjustBalanceManually(discordUser, amount, { reason, metadata } = {}) {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new CurrencyError('INVALID_AMOUNT', '調整額は0ではない値を指定してください。', { amount });
  }

  const type = TRANSACTION_TYPES.ADJUST;
  return adjustBalance(discordUser, amount, type, { reason, metadata });
}
