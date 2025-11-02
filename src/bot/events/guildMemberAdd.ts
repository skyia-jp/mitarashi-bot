import { getGuildSettings } from '../../services/serverService.js';
import type { Client, GuildMember } from 'discord.js';

export default {
  name: 'guildMemberAdd',
  async execute(client: Client, member: GuildMember) {
    if (member.user.bot) return;
    const settings = await getGuildSettings(member.guild.id);
    if (!settings?.autoRoleId) return;

    const role = await member.guild.roles.fetch(settings.autoRoleId).catch(() => null);
    if (!role) return;

    await member.roles.add(role).catch(() => null);
  }
};
