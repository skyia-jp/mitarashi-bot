import prisma from '../client.js';

function getClient(transaction) {
  return transaction ?? prisma;
}

export async function getOrCreateUser(discordUser, transaction) {
  const client = getClient(transaction);
  const data = {
    discordId: discordUser.id,
    username: discordUser.tag ?? discordUser.username
  };

  return client.user.upsert({
    where: { discordId: discordUser.id },
    update: { username: data.username },
    create: data
  });
}

export function getUserByDiscordId(discordId, transaction) {
  const client = getClient(transaction);
  return client.user.findUnique({ where: { discordId } });
}
