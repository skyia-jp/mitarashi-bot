import { PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction } from 'discord.js';
import { getGuildSettings, getGuildStats, updateGuildSettings } from '../../services/serverService.js';

function buildStatsEmbed(guild: any, stats: any) {
  return {
    title: `📊 ${guild.name} のサーバー統計`,
    color: 0x2ecc71,
    fields: [
      {
        name: 'メンバー',
        value: `合計: ${stats.memberTotal}\n人間: ${stats.humanMembers}\nボット: ${stats.botMembers}`,
        inline: true
      },
      {
        name: 'オンライン状況',
        value: `オンライン: ${stats.presence.online}\n退席: ${stats.presence.idle}\n取り込み中: ${stats.presence.dnd}\nオフライン: ${stats.presence.offline}`,
        inline: true
      },
      {
        name: '構成情報',
        value: `チャンネル: ${stats.channelCount}\nロール: ${stats.roleCount}`,
        inline: true
      },
      {
        name: 'ユーティリティ',
        value: `リマインダー: ${stats.reminderCount}\nタスク: ${stats.taskCount}\nメモ: ${stats.noteCount}`,
        inline: true
      },
      {
        name: 'モデレーション',
        value: `警告: ${stats.warningCount}`,
        inline: true
      },
      {
        name: '投票',
        value: `${stats.pollCount}件`,
        inline: true
      }
    ],
    timestamp: new Date().toISOString()
  };
}

function buildSettingsEmbed(settings: any) {
  return {
    title: '⚙️ サーバー設定',
    color: 0x3498db,
    fields: [
      { name: 'ログチャンネル', value: settings?.logChannelId ? `<#${settings.logChannelId}>` : '未設定', inline: true },
      { name: 'ミュートロール', value: settings?.muteRoleId ? `<@&${settings.muteRoleId}>` : '未設定', inline: true },
      { name: 'タイムゾーン', value: settings?.timezone ?? 'Asia/Tokyo', inline: true },
      { name: 'リマインダーロール', value: settings?.reminderRoleId ? `<@&${settings.reminderRoleId}>` : '未設定', inline: true },
      { name: '自動付与ロール', value: settings?.autoRoleId ? `<@&${settings.autoRoleId}>` : '未設定', inline: true }
    ],
    timestamp: new Date().toISOString()
  };
}

export default {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('サーバー統計と設定を管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('stats').setDescription('サーバー統計を表示します'))
    .addSubcommandGroup((group) =>
      group
        .setName('config')
        .setDescription('サーバー設定を表示・更新します')
        .addSubcommand((sub) => sub.setName('view').setDescription('現在の設定を表示します'))
        .addSubcommand((sub) =>
          sub.setName('autorole').setDescription('参加時に自動付与するロールを設定します').addRoleOption((option: any) => option.setName('role').setDescription('自動付与するロール (未指定で解除)').setRequired(false))
        )
        .addSubcommand((sub) => sub.setName('timezone').setDescription('サーバーの標準タイムゾーンを設定します').addStringOption((option: any) => option.setName('value').setDescription('例: Asia/Tokyo').setRequired(true)))
    ),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    if (interaction.options.getSubcommand(false) === 'stats') {
      await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);
      try {
        const stats = await getGuildStats(interaction.guild);
        const embed = buildStatsEmbed(interaction.guild, stats);
        await interaction.editReply({ embeds: [embed as any] }).catch(() => null);
      } catch (err: any) {
        await interaction.editReply({ content: err?.message ?? '統計情報の取得に失敗しました。' }).catch(() => null);
      }
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    if (group !== 'config') return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      try {
        const settings = await getGuildSettings(interaction.guildId);
        await interaction.reply({ embeds: [buildSettingsEmbed(settings) as any], ephemeral: true });
      } catch (err: any) {
        await interaction.reply({ content: err?.message ?? '設定の取得に失敗しました。', ephemeral: true });
      }
      return;
    }

    if (sub === 'autorole') {
      await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);
      try {
        const role = interaction.options.getRole('role') as any | null;
        await updateGuildSettings(interaction.guildId, { autoRoleId: role?.id ?? null });
        await interaction.editReply({ content: role ? `自動付与ロールを ${role} に設定しました。` : '自動付与ロールを解除しました。' }).catch(() => null);
      } catch (err: any) {
        await interaction.editReply({ content: err?.message ?? '設定に失敗しました。' }).catch(() => null);
      }
      return;
    }

    if (sub === 'timezone') {
      await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);
      try {
        const value = interaction.options.getString('value', true);
        await updateGuildSettings(interaction.guildId, { timezone: value });
        await interaction.editReply({ content: `タイムゾーンを ${value} に設定しました。` }).catch(() => null);
      } catch (err: any) {
        await interaction.editReply({ content: err?.message ?? 'タイムゾーンの設定に失敗しました。' }).catch(() => null);
      }
    }
  }
};
