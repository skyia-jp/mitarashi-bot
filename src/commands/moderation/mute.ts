import { PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import ms from 'ms';
import { canModerate, getLogChannel, logAction } from '../../services/moderationService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('ユーザーをタイムアウトします')
    .addUserOption((option) => option.setName('target').setDescription('対象ユーザー').setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('タイムアウト期間 (例: 10m, 1h)').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('理由').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('target', true);
    const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
    const durationInput = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || '理由は指定されていません';

    if (!targetMember) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription('❌ 指定したメンバーが見つかりません。');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
      return;
    }

    if (!canModerate(interaction.member, targetMember)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription('❌ このユーザーをミュートする権限がありません。');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
      return;
    }

    const durationMs = ms(durationInput);
    if (!durationMs || durationMs < 1000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription('❌ 有効な期間を指定してください (1s〜28d)。');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
      return;
    }

    await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);

    try {
      await targetMember.timeout(durationMs, reason as string);

      const moderator = await getOrCreateUser(interaction.user);
      const target = await getOrCreateUser(targetMember.user);

      await logAction({ guildId: interaction.guildId!, userId: target.id, moderatorId: moderator.id, actionType: 'TIMEOUT', reason, expiresAt: new Date(Date.now() + durationMs) });

      const logChannel = await getLogChannel(interaction.guild!);
      if (logChannel) {
        await logChannel.send({ embeds: [ { title: '🔇 ユーザーをタイムアウトしました', description: `ユーザー: ${targetMember.user.tag}\n期間: ${durationInput}\nモデレーター: ${interaction.user.tag}\n理由: ${reason}`, color: 0x3498db, timestamp: new Date().toISOString() } ] }).catch(() => null);
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🔇 タイムアウト')
        .setDescription(`${targetMember.user.tag} を ${durationInput} ミュートしました。`);
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    } catch (err: any) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(`❌ ${err?.message ?? 'ミュートに失敗しました。'}`);
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    }
  }
};
