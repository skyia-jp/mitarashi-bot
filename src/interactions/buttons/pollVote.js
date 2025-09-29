import {
  buildPollEmbed,
  handlePollVote,
  summarizePoll
} from '../../services/pollService.js';

export default {
  customId: 'poll-vote',
  async execute(client, interaction) {
    const segments = interaction.customId.split(':');
    if (segments.length < 3) {
      await interaction.reply({ content: '投票データの取得に失敗しました。', ephemeral: true });
      return;
    }

    const pollId = Number.parseInt(segments[1], 10);
    const optionId = Number.parseInt(segments[2], 10);

    if (Number.isNaN(pollId) || Number.isNaN(optionId)) {
      await interaction.reply({ content: '投票データが不正です。', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await handlePollVote(interaction, pollId, optionId);

    if (result.status === 'closed') {
      await interaction.editReply({ content: 'この投票はすでに締め切られています。' });
      return;
    }

    const summary = await summarizePoll(pollId);

    if (interaction.message && interaction.message.editable) {
      const embed = buildPollEmbed(summary);
      const row = {
        type: 1,
        components: summary.poll.options.map((option) => ({
          type: 2,
          style: 1,
          label: option.label,
          custom_id: `poll-vote:${summary.poll.id}:${option.id}`,
          emoji: option.emoji ?? undefined,
          disabled: summary.poll.status !== 'open'
        }))
      };

      await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => null);
    }

    await interaction.editReply({ content: '投票を受け付けました！' });
  }
};
