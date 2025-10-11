import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildInteractionLogger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ボットをこのサーバーから退出させます')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName('confirm')
        .setDescription('true を指定すると退出します')
        .setRequired(true)
    ),
  async execute(client, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'サーバー内でのみ実行できます。', ephemeral: true });
      return;
    }

    const confirm = interaction.options.getBoolean('confirm', true);
    const logger = buildInteractionLogger(interaction, { module: 'command:leave' });

    if (!confirm) {
      await interaction.reply({ content: 'confirm に true を指定してください。', ephemeral: true });
      logger.info({ event: 'command.leave.cancelled' });
      return;
    }

    try {
      await interaction.reply({ content: 'サーバーから退出します。', ephemeral: true });
      await interaction.guild.leave();
      logger.info({ event: 'command.leave.success', guild_id: interaction.guildId });
    } catch (error) {
      logger.error({ err: error, event: 'command.leave.error', guild_id: interaction.guildId });
      await interaction.followUp({ content: '退出に失敗しました。後で再度お試しください。', ephemeral: true });
    }
  }
};
