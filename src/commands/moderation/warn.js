import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { canModerate, warnUser } from '../../services/moderationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('ユーザーに警告を出します')
    .addUserOption((option) =>
      option.setName('target').setDescription('警告するユーザー').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('警告理由').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('警告レベル (1-5)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(client, interaction) {
    const targetMember = await interaction.guild.members.fetch(
      interaction.options.getUser('target', true)
    );
    const reason = interaction.options.getString('reason', true);
    const level = interaction.options.getInteger('level') ?? 1;

    if (!canModerate(interaction.member, targetMember)) {
      await interaction.reply({ content: 'このユーザーを警告する権限がありません。', ephemeral: true });
      return;
    }

    const { warning, summary, logChannel } = await warnUser(
      interaction,
      targetMember,
      reason,
      level
    );

    const { totalWarnings, totalPoints } = summary;

    const severityColor = getSeverityColor(totalPoints);
    const severityLabel = getSeverityLabel(totalPoints);

    const warningDetails = summary.warnings
      .slice(0, 5)
      .map((entry) => {
        const timestamp = entry.createdAt instanceof Date
          ? entry.createdAt.toLocaleString()
          : new Date(entry.createdAt).toLocaleString();
        const moderatorTag = entry.moderator?.username ?? '不明';
        return `• [${entry.penaltyLevel}] ${entry.reason} (by ${moderatorTag} / ${timestamp})`;
      })
      .join('\n') || '記録なし';

    if (logChannel) {
      await logChannel.send({
        embeds: [
          {
            title: '⚠️ 警告を発行しました',
            description: `ユーザー: ${targetMember.user.tag}\n警告レベル: ${level}\nモデレーター: ${interaction.user.tag}\n理由: ${reason}`,
            color: severityColor,
            timestamp: new Date().toISOString(),
            fields: [
              {
                name: '累計情報',
                value: `警告数: ${totalWarnings}\n累計ポイント: ${totalPoints}\nステータス: ${severityLabel}`
              },
              {
                name: '直近の警告',
                value: warningDetails
              }
            ],
            footer: { text: `Warning ID: ${warning.id}` }
          }
        ]
      });
    }

    await targetMember.send({
      embeds: [
        {
          title: `⚠️ ${interaction.guild.name} からの警告`,
          description: `理由: ${reason}\n警告レベル: ${level}\n累計警告数: ${totalWarnings}\n累計ポイント: ${totalPoints}\n現在のステータス: ${severityLabel}`,
          color: severityColor,
          timestamp: new Date().toISOString()
        }
      ]
    }).catch(() => null);

    await interaction.reply({
      content: `${targetMember} にレベル${level}の警告を発行しました。累計: ${totalWarnings}件 / ${totalPoints}ポイント（ステータス: ${severityLabel}）`,
      ephemeral: true
    });
  }
};

function getSeverityColor(points) {
  if (points >= 15) return 0xdc3545; // red
  if (points >= 8) return 0xffc107; // amber
  if (points >= 4) return 0x0dcaf0; // cyan
  return 0x198754; // green
}

function getSeverityLabel(points) {
  if (points >= 15) return '危険';
  if (points >= 8) return '警戒';
  if (points >= 4) return '注意';
  return '安定';
}
