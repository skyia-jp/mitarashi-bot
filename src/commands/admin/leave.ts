import { PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction } from 'discord.js';
import { buildInteractionLogger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ボットをこのサーバーから退出させます')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) => option.setName('confirm').setDescription('true を指定すると退出します').setRequired(true))
    .addStringOption((option) => option.setName('guild_id').setDescription('指定したサーバー ID から退出します').setRequired(false)),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const confirm = interaction.options.getBoolean('confirm', true);
    const specifiedGuildId = interaction.options.getString('guild_id');
    const targetGuildId = specifiedGuildId ?? interaction.guildId ?? null;
    const logger = buildInteractionLogger(interaction, { module: 'command:leave', target_guild_id: targetGuildId ?? undefined });
    const ephemeral = interaction.inGuild();

    const respond = async (content: string) => {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral }).catch(() => null);
      } else {
        await interaction.reply({ content, ephemeral }).catch(() => null);
      }
    };

    if (!confirm) {
      await respond('confirm に true を指定してください。');
      logger.info({ event: 'command.leave.cancelled' });
      return;
    }

    if (!targetGuildId) {
      await respond('DM から利用する場合は guild_id を指定してください。');
      logger.info({ event: 'command.leave.no_target' });
      return;
    }

    let targetGuild;
    try {
      targetGuild = await client.guilds.fetch(targetGuildId);
    } catch (error: any) {
      logger.error({ err: error, event: 'command.leave.fetch_failed', target_guild_id: targetGuildId });
    }

    if (!targetGuild) {
      const notFoundMessage = specifiedGuildId
        ? '指定されたサーバーが見つからないか、ボットが参加していません。'
        : 'サーバーが見つかりませんでした。';
      await respond(notFoundMessage);
      logger.warn({ event: 'command.leave.not_found', target_guild_id: targetGuildId });
      return;
    }

    const leavingCurrentGuild = interaction.guildId === targetGuild.id;
    const initialMessage = leavingCurrentGuild ? 'サーバーから退出します。' : `指定されたサーバー (${targetGuild.name ?? '名称不明'} / ${targetGuild.id}) から退出します。`;

    await respond(initialMessage);

    try {
      await targetGuild.leave();
      logger.info({ event: 'command.leave.success', target_guild_id: targetGuild.id });
    } catch (error: any) {
      logger.error({ err: error, event: 'command.leave.error', target_guild_id: targetGuild.id });
      await interaction.followUp({ content: '退出に失敗しました。後で再度お試しください。', ephemeral }).catch(() => null);
    }
  }
};
