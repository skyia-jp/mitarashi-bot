import prisma from '../client.js';

export async function upsertGuild(guild) {
  return prisma.guild.upsert({
    where: { id: guild.id },
    update: { name: guild.name },
    create: {
      id: guild.id,
      name: guild.name
    }
  });
}

export async function getGuildConfig(guildId) {
  return prisma.guildConfig.findUnique({
    where: { guildId }
  });
}

export async function upsertGuildConfig(guildId, data) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data }
  });
}
