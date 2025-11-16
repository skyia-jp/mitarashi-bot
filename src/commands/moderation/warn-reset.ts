import { PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { canModerate, resetUserWarnings } from '../../services/moderationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn-reset')
    .setDescription('指定ユーザーの警告レベルとポイントを初期化します')
    .addUserOption((option) => option.setName('target').setDescription('警告を初期化するユーザー').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('初期化の理由').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);

    try {
      const targetMember = await interaction.guild?.members.fetch(interaction.options.getUser('target', true)) || null;
      const reason = interaction.options.getString('reason')?.trim() || '警告ポイントの初期化';

      if (!targetMember) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription('❌ 指定したユーザーが見つかりませんでした。');
        await interaction.editReply({ embeds: [embed] }).catch(() => null);
        return;
      }

      if (!canModerate(interaction.member, targetMember)) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription('❌ このユーザーの警告を初期化する権限がありません。');
        await interaction.editReply({ embeds: [embed] }).catch(() => null);
        return;
      }

      const { clearedCount, beforeSummary, afterSummary, logChannel } = await resetUserWarnings(interaction, targetMember, reason);

      const beforeSeverity = getSeverityLabel(beforeSummary.totalPoints);
      const afterSeverity = getSeverityLabel(afterSummary.totalPoints);

      if (logChannel) {
        await logChannel.send({
          embeds: [
            {
              title: '♻️ 警告ポイントを初期化しました',
              description: `ユーザー: ${targetMember.user.tag}\nモデレーター: ${interaction.user.tag}\n理由: ${reason}`,
              color: getSeverityColor(afterSummary.totalPoints),
              timestamp: new Date().toISOString(),
              fields: [
                { name: '初期化前', value: formatSummaryField(beforeSummary, beforeSeverity), inline: true },
                { name: '初期化後', value: formatSummaryField(afterSummary, afterSeverity), inline: true }
              ],
              footer: { text: `削除した警告数: ${clearedCount}` }
            }
          ]
        }).catch(() => null);
      }

      await targetMember.send({
        embeds: [
          {
            title: `♻️ ${interaction.guild?.name ?? 'サーバー'} からのお知らせ`,
            description: `あなたの警告ポイントはリセットされました。\n理由: ${reason}`,
            color: getSeverityColor(afterSummary.totalPoints),
            timestamp: new Date().toISOString(),
            fields: [{ name: '現在のステータス', value: formatSummaryField(afterSummary, afterSeverity) }]
          }
        ]
      }).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(getSeverityColor(afterSummary.totalPoints))
        .setTitle('♻️ 警告初期化')
        .setDescription(`${targetMember} の警告を初期化しました。`)
        .addFields({ name: '削除件数', value: `${clearedCount}件` });
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    } catch (err: any) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(`❌ ${err?.message ?? '警告の初期化に失敗しました。'}`);
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    }
  }
};

function formatSummaryField(summary: any, severityLabel: string) {
  return `警告数: ${summary.totalWarnings}\nポイント: ${summary.totalPoints}\nステータス: ${severityLabel}`;
}

function getSeverityColor(points: number) {
  if (points >= 15) return 0xdc3545; // red
  if (points >= 8) return 0xffc107; // amber
  if (points >= 4) return 0x0dcaf0; // cyan
  return 0x198754; // green
}

function getSeverityLabel(points: number) {
  if (points >= 15) return '危険';
  if (points >= 8) return '警戒';
  if (points >= 4) return '注意';
  return '安定';
}
