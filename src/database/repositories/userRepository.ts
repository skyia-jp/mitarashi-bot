import prisma from '../client.js';
import type { User } from '@prisma/client';

function getClient(transaction?: any) {
  return transaction ?? prisma;
}

export async function getOrCreateUser(
  discordUser: { id: string; tag?: string; username?: string },
  transaction?: any
): Promise<User> {
  const client = getClient(transaction);
  const data = {
    discordId: discordUser.id,
    username: discordUser.tag ?? discordUser.username
  } as const;

  return client.user.upsert({
    where: { discordId: discordUser.id },
    update: { username: data.username },
    create: data
  });
}

export function getUserByDiscordId(discordId: string, transaction?: any): Promise<User | null> {
  const client = getClient(transaction);
  return client.user.findUnique({ where: { discordId } });
}
