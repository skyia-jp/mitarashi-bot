import prisma from '../client.js';
import type { CurrencyBalance, CurrencyTransaction } from '@prisma/client';

function getClient(transaction?: any) {
  return transaction ?? prisma;
}

export function findBalanceByGuildAndUser(guildId: string, userId: number, transaction?: any): Promise<CurrencyBalance | null> {
  const client = getClient(transaction);
  return client.currencyBalance.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId
      }
    }
  });
}

export function upsertBalance(guildId: string, userId: number, transaction?: any) {
  const client = getClient(transaction);
  return client.currencyBalance.upsert({
    where: {
      guildId_userId: {
        guildId,
        userId
      }
    },
    update: {},
    create: { guildId, userId }
  });
}

export function updateBalanceById(id: number, balance: number, transaction?: any) {
  const client = getClient(transaction);
  return client.currencyBalance.update({
    where: { id },
    data: { balance }
  });
}

export function createTransaction(data: any, transaction?: any): Promise<CurrencyTransaction> {
  const client = getClient(transaction);
  return client.currencyTransaction.create({ data });
}

export function findLatestTransactionByType(guildId: string, userId: number, type: string, transaction?: any) {
  const client = getClient(transaction);
  return client.currencyTransaction.findFirst({
    where: { guildId, userId, type },
    orderBy: { createdAt: 'desc' }
  });
}
