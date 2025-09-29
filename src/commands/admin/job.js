import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import {
  configureActivitySummary,
  ensureActivitySummaryJob,
  setActivitySummaryActive
} from '../../services/jobService.js';
import { getJobByGuildAndType } from '../../database/repositories/scheduledJobRepository.js';

function buildStatusEmbed(job) {
  if (!job) {
    return {
      title: '🔄 定期タスク情報',
      description: 'アクティビティサマリーはまだ設定されていません。',
      color: 0x95a5a6
    };
  }

  return {
    title: '🔄 アクティビティサマリー設定',
    color: job.isActive ? 0x2ecc71 : 0xe74c3c,
    fields: [
      { name: 'ステータス', value: job.isActive ? '有効' : '無効', inline: true },
      { name: 'スケジュール', value: job.schedule, inline: true },
      {
        name: '通知チャンネル',
        value: job.data?.channelId ? `<#${job.data.channelId}>` : 'ログチャンネルを利用',
        inline: true
      },
      { name: '集計日数', value: `${job.data?.days ?? 7}日`, inline: true },
      { name: '上位表示件数', value: `${job.data?.limit ?? 5}件`, inline: true }
    ],
    footer: job.lastRun ? { text: `最終実行: ${job.lastRun.toLocaleString()}` } : undefined
  };
}

export default {
  data: new SlashCommandBuilder()
    .setName('job')
    .setDescription('定期実行タスクを管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('status').setDescription('アクティビティサマリーの設定を表示します'))
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('アクティビティサマリー通知を有効化します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('アクティビティサマリー通知を無効化します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('configure')
        .setDescription('アクティビティサマリーの設定を変更します')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('通知先チャンネル (省略時はモデレーションログ)')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption((option) =>
          option
            .setName('schedule')
            .setDescription('cron形式のスケジュール (例: 0 0 * * *)')
        )
        .addIntegerOption((option) =>
          option.setName('days').setDescription('集計対象日数 (1-30)').setMinValue(1).setMaxValue(30)
        )
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('表示件数 (1-20)').setMinValue(1).setMaxValue(20)
        )
    ),
  async execute(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      const job = await getJobByGuildAndType(interaction.guildId, 'activity-summary');
      await interaction.reply({ embeds: [buildStatusEmbed(job)], ephemeral: true });
      return;
    }

    if (subcommand === 'enable') {
      await ensureActivitySummaryJob(client, interaction.guildId);
      const result = await setActivitySummaryActive(client, interaction.guildId, true);
      if (result.count === 0) {
        await interaction.reply({ content: '既に有効になっています。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'アクティビティサマリーを有効化しました。', ephemeral: true });
      }
      return;
    }

    if (subcommand === 'disable') {
      const result = await setActivitySummaryActive(client, interaction.guildId, false);
      if (result.count === 0) {
        await interaction.reply({ content: '既に無効になっています。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'アクティビティサマリーを無効化しました。', ephemeral: true });
      }
      return;
    }

    if (subcommand === 'configure') {
      const channel = interaction.options.getChannel('channel');
      const schedule = interaction.options.getString('schedule') ?? '0 0 * * *';
      const days = interaction.options.getInteger('days') ?? 7;
      const limit = interaction.options.getInteger('limit') ?? 5;

      await configureActivitySummary(client, interaction.guildId, {
        schedule,
        channelId: channel?.id ?? null,
        days,
        limit
      });

      await interaction.reply({
        content: `アクティビティサマリーを設定しました。スケジュール: ${schedule}`,
        ephemeral: true
      });

      await ensureActivitySummaryJob(client, interaction.guildId);
    }
  }
};
