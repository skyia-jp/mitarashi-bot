import { SlashCommandBuilder } from 'discord.js';
import { calculateEmbedColor, formatHand, playPoker, valueToLabel } from '../../services/pokerService.js';
import { prepareGameBias, recordGameOutcome } from '../../services/gameBiasService.js';

const RESULT_MESSAGES = {
  player: 'あなたの勝ち！',
  dealer: 'ボットの勝ち…',
  draw: '引き分け'
};

function formatEvaluationDetail(evaluation) {
  const labels = evaluation.strength.map((value) => valueToLabel(value));
  const [first, second, third, fourth] = labels;

  switch (evaluation.rank) {
    case 8:
      return `ハイカード: ${first}`;
    case 7:
      return `フォーカード: ${first}, キッカー: ${second}`;
    case 6:
      return `スリーカード: ${first}, ペア: ${second}`;
    case 5:
      return `高い順: ${labels.join(' ')}`;
    case 4:
      return `ハイカード: ${first}`;
    case 3: {
      const kickers = [second, third].filter(Boolean).join(' ');
      return kickers ? `スリーカード: ${first}, キッカー: ${kickers}` : `スリーカード: ${first}`;
    }
    case 2: {
      const kicker = third ?? '-';
      return `ペア: ${first} と ${second}, キッカー: ${kicker}`;
    }
    case 1: {
      const kickers = [second, third, fourth].filter(Boolean).join(' ');
      return kickers ? `ペア: ${first}, キッカー: ${kickers}` : `ペア: ${first}`;
    }
    default:
      return `高い順: ${labels.join(' ')}`;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('poker')
    .setDescription('ポーカーでボットと勝負！'),
  async execute(client, interaction) {
    await interaction.deferReply();
    const bias = await prepareGameBias(interaction, 'poker');
    const attempts = [];

    let game = playPoker();
    attempts.push(game);

    if (game.result === 'dealer' && bias.rerollChance > 0 && Math.random() < bias.rerollChance) {
      const retry = playPoker();
      attempts.push(retry);
      game = retry;
    }

    await recordGameOutcome(interaction, 'poker', bias.userRecord, game.result);
    const playerHandText = formatHand(game.player.hand);
    const dealerHandText = formatHand(game.dealer.hand);

    const embed = {
      title: 'ポーカー対決',
      description: [
        `🃏 あなた: **${game.player.evaluation.label}**`,
        `🤖 ボット: **${game.dealer.evaluation.label}**`
      ].join('\n'),
      color: calculateEmbedColor(game.result),
      fields: [
        {
          name: 'あなたの手札',
          value: `\`${playerHandText}\`\n${formatEvaluationDetail(game.player.evaluation)}`
        },
        {
          name: 'ボットの手札',
          value: `\`${dealerHandText}\`\n${formatEvaluationDetail(game.dealer.evaluation)}`
        }
      ],
      footer: {
        text: `${RESULT_MESSAGES[game.result] ?? '引き分け'} | 勝率補正: ${Math.round(bias.winRate * 100)}% | 再挑戦: ${Math.max(attempts.length - 1, 0)}回`
      },
      timestamp: new Date().toISOString()
    };

    if (attempts.length > 1) {
      embed.fields.push({
        name: '再挑戦の結果',
        value: attempts
          .map((attempt, index) => {
            const hand = `${formatHand(attempt.player.hand)} vs ${formatHand(attempt.dealer.hand)}`;
            return `${index === 0 ? '初回' : `再挑戦${index}`} → ${attempt.result === 'player' ? '勝ち' : attempt.result === 'dealer' ? '負け' : '引き分け'} (${hand})`;
          })
          .join('\n')
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
