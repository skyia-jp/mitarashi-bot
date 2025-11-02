import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import {
  attachPollMessageId,
  buildPollEmbed,
  closePollWithSummary,
  createGuildPoll,
  getPollByMessageId,
  listGuildPolls,
  summarizePoll
} from '../../services/pollService.js';
import { buildInteractionLogger } from '../../utils/logger.js';

const DEFAULT_LIST_LIMIT = 10;
const MAX_LIST_LIMIT = 20;

const buildPollLogger = (interaction: any, context = {}, meta = {}) =>
  buildInteractionLogger(
    interaction,
    {
      module: 'command:poll',
      ...context
    },
    meta
  );

function collectOptions(interaction: any) {
  const options: Array<any> = [];
  for (let i = 1; i <= 5; i += 1) {
    const label = interaction.options.getString(`option${i}`);
    if (!label) continue;
    const emoji = interaction.options.getString(`emoji${i}`) ?? undefined;
    options.push({ label, emoji });
  }
  return options;
}

function buildActionRow(poll: any, disabled = false) {
  return {
    type: 1,
    components: poll.options.map((option: any) => ({
      type: 2,
      style: 1,
      label: option.label,
      custom_id: `poll-vote:${poll.id}:${option.id}`,
      emoji: option.emoji ?? undefined,
      disabled
    }))
  };
}

function truncate(text: any, maxLength: number) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function toDiscordTimestamp(date: any) {
  if (!(date instanceof Date)) return '日時不明';
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

export default {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName('poll')
      .setDescription('投票を作成・管理します')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) => {
        let scoped = sub
          .setName('create')
          .setDescription('新しい投票を作成します')
          .addStringOption((option) =>
            option.setName('question').setDescription('投票内容').setRequired(true)
          )
          .addStringOption((option) =>
            option.setName('option1').setDescription('1番目の選択肢').setRequired(true)
          )
          .addStringOption((option) =>
            option.setName('option2').setDescription('2番目の選択肢').setRequired(true)
          );

        for (let i = 3; i <= 5; i += 1) {
          scoped = scoped.addStringOption((option) =>
            option.setName(`option${i}`).setDescription(`${i}番目の選択肢`).setRequired(false)
          );
        }

        for (let i = 1; i <= 5; i += 1) {
          scoped = scoped.addStringOption((option) =>
            option
              .setName(`emoji${i}`)
              .setDescription(`${i}番目の選択肢に付与する絵文字`)
              .setRequired(false)
          );
        }

        return scoped;
      })
      .addSubcommand((sub) =>
        sub
          .setName('close')
          .setDescription('投票を締め切ります')
          .addStringOption((option) =>
            option.setName('message_id').setDescription('投票メッセージID').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('results')
          .setDescription('投票結果を表示します')
          .addStringOption((option) =>
            option.setName('message_id').setDescription('投票メッセージID').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('list')
          .setDescription('登録済みの投票を一覧表示します')
          .addIntegerOption((option) =>
            option
              .setName('limit')
              .setDescription('取得する最大件数 (1-20)')
              .setMinValue(1)
              .setMaxValue(MAX_LIST_LIMIT)
          )
      );

    return builder;
  })(),
  async execute(client: any, interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      await interaction.deferReply({ ephemeral: true });
      const question = interaction.options.getString('question', true);
      const options = collectOptions(interaction);

      if (options.length < 2) {
        await interaction.editReply({ content: '選択肢は最低2つ必要です。' });
        return;
      }

      const poll = await createGuildPoll(interaction, { question, options });
      const summary = await summarizePoll(poll.id);
      const embed = buildPollEmbed(summary);
      const row = buildActionRow(poll);

      const pollMessage = await interaction.channel.send({ embeds: [embed], components: [row] });
      await attachPollMessageId(poll.id, pollMessage.id);

      await interaction.editReply({ content: `投票を作成しました。メッセージID: ${pollMessage.id}` });
      return;
    }

    if (subcommand === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const limit = interaction.options.getInteger('limit') ?? DEFAULT_LIST_LIMIT;
      const listLogger = buildPollLogger(
        interaction,
        { action: 'list' },
        { limit }
      );

      listLogger.info({ event: 'poll.list.start', limit });

      try {
        const polls = await listGuildPolls(interaction.guildId, { limit });

        if (!polls.length) {
          listLogger.info({ event: 'poll.list.empty' }, 'No polls found for guild');
          await interaction.editReply({ content: '登録済みの投票はありません。' });
          return;
        }

        const lines = polls.map((poll: any) => {
          const statusLabel = poll.status === 'open' ? '🟢 開催中' : '⚪ 終了';
          const channelLabel = poll.channelId ? `<#${poll.channelId}>` : 'チャンネル不明';
          const messageLabel = poll.messageId ? poll.messageId : '未設定';
          const timestamp = toDiscordTimestamp(poll.createdAt);
          const question = truncate(poll.question, 200);
          const link = poll.messageId && poll.channelId
            ? `https://discord.com/channels/${interaction.guildId}/${poll.channelId}/${poll.messageId}`
            : null;

          return [
            `${statusLabel} ${question}`,
            `MessageID: ${messageLabel} ｜ Channel: ${channelLabel} ｜ 作成: ${timestamp}`,
            link ? `リンク: ${link}` : null
          ]
            .filter(Boolean)
            .join('\n');
        });

        const embed = {
          title: '📋 登録済み投票一覧',
          description: lines.join('\n\n').slice(0, 4096),
          color: 0x5865f2,
          footer: {
            text: `表示件数: ${polls.length} / ${limit}`
          },
          timestamp: new Date().toISOString()
        };

        listLogger.info({ event: 'poll.list.success', count: polls.length }, 'Poll list returned');
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        listLogger.error({ err: error, event: 'poll.list.error' }, 'Failed to fetch poll list');
        await interaction.editReply({ content: '投票一覧の取得に失敗しました。後で再度お試しください。' });
      }

      return;
    }

    const messageId = interaction.options.getString('message_id', true);
    const poll = await getPollByMessageId(messageId);

    if (!poll) {
      await interaction.reply({ content: '指定した投票が見つかりません。', ephemeral: true });
      return;
    }

    if (subcommand === 'close') {
      await interaction.deferReply({ ephemeral: true });
      const summary = await closePollWithSummary(poll.id);
      const embed = buildPollEmbed(summary);
      const row = buildActionRow(summary.poll, true);

      const channel = await interaction.guild.channels.fetch(poll.channelId).catch(() => null);
      const message = await channel?.messages.fetch(messageId).catch(() => null);
      if (message) {
        await message.edit({ embeds: [embed], components: [row] });
      }

      await interaction.editReply({ content: '投票を締め切りました。' });
      return;
    }

    if (subcommand === 'results') {
      await interaction.deferReply({ ephemeral: true });
      const summary = await summarizePoll(poll.id);
      const embed = buildPollEmbed(summary);
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
