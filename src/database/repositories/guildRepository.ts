import prisma from '../client.js';

export async function upsertGuild(guild: { id: string; name?: string }): Promise<any> {
  return prisma.guild.upsert({
    where: { id: guild.id },
    update: { name: guild.name },
    create: {
      id: guild.id,
      name: guild.name
    }
  });
}

export async function getGuildConfig(guildId: string): Promise<any> {
  return prisma.guildConfig.findUnique({
    where: { guildId }
  });
}

export async function upsertGuildConfig(guildId: string, data: any): Promise<any> {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data }
  });
}
