import { SlashCommandBuilder, Client, ChatInputCommandInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { handlePasswordSubmission } from '../../services/passwordGrantService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('password')
    .setDescription('パスワードを入力してロールを取得します')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('value')
        .setDescription('共有されたパスワードを入力してください')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(128)
    ),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    // Defer reply using flags (ephemeral)
    await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);

    const password = interaction.options.getString('value', true);
    const member = (interaction.member as GuildMember) ?? (await interaction.guild?.members.fetch(interaction.user.id));

    try {
      const result = await handlePasswordSubmission(interaction.guild, member as GuildMember, password);
      const embed = new EmbedBuilder()
        .setColor(result.success ? 0x00ff00 : 0xff0000)
        .setDescription(result.message);
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    } catch (err: any) {
      // If service throws, return a friendly message
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(err?.message ?? '❌ エラーが発生しました。');
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    }
  }
};
