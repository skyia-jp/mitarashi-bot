import { PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction } from 'discord.js';
import { canModerate, getLogChannel, logAction } from '../../services/moderationService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('ユーザーをBANします')
    .addUserOption((option) => option.setName('target').setDescription('BANするユーザー').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('理由').setRequired(false))
    .addIntegerOption((option) =>
      option.setName('delete_days').setDescription('削除するメッセージの日数 (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || '理由は指定されていません';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    // fetch member safely
    const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
    if (member && !canModerate(interaction.member, member)) {
      await interaction.reply({ content: 'このユーザーをBANする権限がありません。', ephemeral: true }).catch(() => null);
      return;
    }

    // defer because we will perform DB writes and message sending
    await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);

    try {
      await interaction.guild?.members.ban(user, { reason, deleteMessageDays: deleteDays });

      const moderator = await getOrCreateUser(interaction.user);
      const targetUser = await getOrCreateUser(user);

      await logAction({ guildId: interaction.guildId!, userId: targetUser.id, moderatorId: moderator.id, actionType: 'BAN', reason });

      const logChannel = await getLogChannel(interaction.guild!);
      if (logChannel) {
        await logChannel.send({ embeds: [ { title: '🔨 メンバーをBANしました', description: `ユーザー: ${user.tag}\nモデレーター: ${interaction.user.tag}\n理由: ${reason}`, color: 0xff0000, timestamp: new Date().toISOString() } ] }).catch(() => null);
      }

      await interaction.editReply({ content: `${user.tag} をBANしました。` }).catch(() => null);
    } catch (err: any) {
      await interaction.editReply({ content: err?.message ?? 'BAN に失敗しました。' }).catch(() => null);
    }
  }
};
