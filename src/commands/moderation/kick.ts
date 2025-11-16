import { PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { canModerate, getLogChannel, logAction } from '../../services/moderationService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('ユーザーをキックします')
    .addUserOption((option) => option.setName('target').setDescription('キックするユーザー').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('理由').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    // fetch target member
    const targetUser = interaction.options.getUser('target', true);
    const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
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
        .setDescription('❌ このユーザーをキックする権限がありません。');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
      return;
    }

    await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);

    try {
      await targetMember.kick(reason);

      const moderator = await getOrCreateUser(interaction.user);
      const target = await getOrCreateUser(targetMember.user);

      await logAction({ guildId: interaction.guildId!, userId: target.id, moderatorId: moderator.id, actionType: 'KICK', reason });

      const logChannel = await getLogChannel(interaction.guild!);
      if (logChannel) {
        await logChannel.send({ embeds: [ { title: '👢 メンバーをキックしました', description: `ユーザー: ${targetMember.user.tag}\nモデレーター: ${interaction.user.tag}\n理由: ${reason}`, color: 0xffa500, timestamp: new Date().toISOString() } ] }).catch(() => null);
      }

      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('👢 キック')
        .setDescription(`${targetMember.user.tag} をキックしました。`);
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    } catch (err: any) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription(`❌ ${err?.message ?? 'キックに失敗しました。'}`);
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    }
  }
};
