import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import {
  attachPollMessageId,
  buildPollEmbed,
  closePollWithSummary,
  createGuildPoll,
  getPollByMessageId,
  summarizePoll
} from '../../services/pollService.js';

function collectOptions(interaction) {
  const options = [];
  for (let i = 1; i <= 5; i += 1) {
    const label = interaction.options.getString(`option${i}`);
    if (!label) continue;
    const emoji = interaction.options.getString(`emoji${i}`) ?? undefined;
    options.push({ label, emoji });
  }
  return options;
}

function buildActionRow(poll, disabled = false) {
  return {
    type: 1,
    components: poll.options.map((option) => ({
      type: 2,
      style: 1,
      label: option.label,
      custom_id: `poll-vote:${poll.id}:${option.id}`,
      emoji: option.emoji ?? undefined,
      disabled
    }))
  };
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
      );

    return builder;
  })(),
  async execute(client, interaction) {
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
