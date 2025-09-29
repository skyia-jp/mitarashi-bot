import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import ms from 'ms';
import { canModerate, getLogChannel, logAction } from '../../services/moderationService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('ユーザーをタイムアウトします')
    .addUserOption((option) =>
      option.setName('target').setDescription('対象ユーザー').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('タイムアウト期間 (例: 10m, 1h)')
        .setRequired(true)
    )
    .addStringOption((option) => option.setName('reason').setDescription('理由').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(client, interaction) {
    const targetMember = await interaction.guild.members.fetch(
      interaction.options.getUser('target', true)
    );
    const durationInput = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || '理由は指定されていません';

    if (!canModerate(interaction.member, targetMember)) {
      await interaction.reply({ content: 'このユーザーをミュートする権限がありません。', ephemeral: true });
      return;
    }

    const durationMs = ms(durationInput);
    if (!durationMs || durationMs < 1000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      await interaction.reply({ content: '有効な期間を指定してください (1s〜28d)。', ephemeral: true });
      return;
    }

    await targetMember.timeout(durationMs, reason);

    const moderator = await getOrCreateUser(interaction.user);
    const targetUser = await getOrCreateUser(targetMember.user);

    await logAction({
      guildId: interaction.guildId,
      userId: targetUser.id,
      moderatorId: moderator.id,
      actionType: 'TIMEOUT',
      reason,
      expiresAt: new Date(Date.now() + durationMs)
    });

    const logChannel = await getLogChannel(interaction.guild);
    if (logChannel) {
      await logChannel.send({
        embeds: [
          {
            title: '🔇 ユーザーをタイムアウトしました',
            description: `ユーザー: ${targetMember.user.tag}\n期間: ${durationInput}\nモデレーター: ${interaction.user.tag}\n理由: ${reason}`,
            color: 0x3498db,
            timestamp: new Date().toISOString()
          }
        ]
      });
    }

    await interaction.reply({ content: `${targetMember.user.tag} を ${durationInput} ミュートしました。`, ephemeral: true });
  }
};
