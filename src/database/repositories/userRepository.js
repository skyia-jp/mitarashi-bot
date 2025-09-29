import prisma from '../client.js';

export async function getOrCreateUser(discordUser) {
  const data = {
    discordId: discordUser.id,
    username: discordUser.tag ?? discordUser.username
  };

  return prisma.user.upsert({
    where: { discordId: discordUser.id },
    update: { username: data.username },
    create: data
  });
}

export function getUserByDiscordId(discordId) {
  return prisma.user.findUnique({ where: { discordId } });
}
