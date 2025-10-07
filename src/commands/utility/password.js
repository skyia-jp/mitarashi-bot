import { SlashCommandBuilder } from 'discord.js';
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
  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const password = interaction.options.getString('value', true);
    const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id));

    const result = await handlePasswordSubmission(interaction.guild, member, password);

    await interaction.editReply({ content: result.message });
  }
};
