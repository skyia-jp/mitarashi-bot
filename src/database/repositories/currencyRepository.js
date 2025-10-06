import prisma from '../client.js';

function getClient(transaction) {
  return transaction ?? prisma;
}

export function findBalanceByUserId(userId, transaction) {
  const client = getClient(transaction);
  return client.currencyBalance.findUnique({ where: { userId } });
}

export function upsertBalance(userId, transaction) {
  const client = getClient(transaction);
  return client.currencyBalance.upsert({
    where: { userId },
    update: {},
    create: { userId }
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

export function findLatestTransactionByType(userId, type, transaction) {
  const client = getClient(transaction);
  return client.currencyTransaction.findFirst({
    where: { userId, type },
    orderBy: { createdAt: 'desc' }
  });
}
