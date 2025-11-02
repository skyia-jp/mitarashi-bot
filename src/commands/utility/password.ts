import { SlashCommandBuilder, Client, ChatInputCommandInteraction, GuildMember } from 'discord.js';
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
      await interaction.editReply({ content: result.message }).catch(() => null);
    } catch (err: any) {
      // If service throws, return a friendly message
      await interaction.editReply({ content: err?.message ?? 'エラーが発生しました。' }).catch(() => null);
    }
  }
};
