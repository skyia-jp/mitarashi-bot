import prisma from '../client.js';

function getClient(transaction) {
  return transaction ?? prisma;
}

export function findBalanceByGuildAndUser(guildId, userId, transaction) {
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

export function upsertBalance(guildId, userId, transaction) {
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

export function updateBalanceById(id, balance, transaction) {
  const client = getClient(transaction);
  return client.currencyBalance.update({
    where: { id },
    data: { balance }
  });
}

export function createTransaction(data, transaction) {
  const client = getClient(transaction);
  return client.currencyTransaction.create({ data });
}

export function findLatestTransactionByType(guildId, userId, type, transaction) {
  const client = getClient(transaction);
  return client.currencyTransaction.findFirst({
    where: { guildId, userId, type },
    orderBy: { createdAt: 'desc' }
  });
}
