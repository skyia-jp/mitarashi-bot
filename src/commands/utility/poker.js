import { SlashCommandBuilder } from 'discord.js';
import { calculateEmbedColor, formatHand, playPoker, valueToLabel } from '../../services/pokerService.js';
import { prepareGameBias, recordGameOutcome } from '../../services/gameBiasService.js';
import {
  CurrencyError,
  credit,
  getBalance,
  placeBet,
  payoutWin,
  TRANSACTION_TYPES
} from '../../services/currencyService.js';

const intl = new Intl.NumberFormat('ja-JP');

function formatCoins(amount) {
  return `${intl.format(amount)} MITACoin`;
}

function formatDelta(amount) {
  if (amount > 0) return `+${intl.format(amount)} MITACoin`;
  if (amount < 0) return `-${intl.format(Math.abs(amount))} MITACoin`;
  return '±0 MITACoin';
}

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
    .setDescription('ポーカーでボットと勝負！')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('賭ける MITACoin の額 (任意)')
        .setMinValue(1)
    ),
  async execute(client, interaction) {
    await interaction.deferReply();

    const betAmount = interaction.options.getInteger('bet') ?? 0;
    let betPlaced = false;
    let netChange = 0;

    try {
      if (betAmount > 0) {
        await placeBet(interaction.guild, interaction.user, betAmount, {
          game: 'poker',
          interactionId: interaction.id
        });
        betPlaced = true;
      }

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

      if (betPlaced) {
        if (game.result === 'player') {
          const payout = betAmount * 2;
          await payoutWin(interaction.guild, interaction.user, payout, {
            game: 'poker',
            interactionId: interaction.id,
            originalBet: betAmount
          });
          netChange = betAmount;
        } else if (game.result === 'draw') {
          await credit(interaction.guild, interaction.user, betAmount, {
            type: TRANSACTION_TYPES.ADJUST,
            reason: 'ポーカー引き分け返金',
            metadata: {
              game: 'poker',
              interactionId: interaction.id
            }
          });
          netChange = 0;
        } else {
          netChange = -betAmount;
        }

        const { balance } = await getBalance(interaction.guild, interaction.user);
        const summary = `ベット: ${formatCoins(betAmount)} | 収支: ${formatDelta(netChange)} | 残高: ${formatCoins(balance.balance)}`;
        embed.footer.text = `${embed.footer.text} | ${summary}`;
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (betPlaced && netChange === 0 && !(error instanceof CurrencyError)) {
        // In case of unexpected error after placing the bet, refund to avoid loss.
        await credit(interaction.guild, interaction.user, betAmount, {
          type: TRANSACTION_TYPES.ADJUST,
          reason: 'システムエラー返金',
          metadata: { game: 'poker', interactionId: interaction.id }
        }).catch(() => null);
      }

      if (error instanceof CurrencyError) {
        if (error.code === 'INSUFFICIENT_FUNDS') {
          await interaction.editReply({
            content: `💸 残高が不足しています。（必要: ${formatCoins(error.context.required ?? betAmount)}）`
          });
          return;
        }
        await interaction.editReply({ content: `⚠️ エラー: ${error.message}` });
        return;
      }

      throw error;
    }
  }
};
