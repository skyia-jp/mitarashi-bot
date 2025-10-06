import { SlashCommandBuilder } from 'discord.js';
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

const DICE_EMOJI = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function rollDice() {
  return [
    Math.ceil(Math.random() * 6),
    Math.ceil(Math.random() * 6),
    Math.ceil(Math.random() * 6)
  ].sort((a, b) => a - b);
}

function evaluateHand(dice) {
  const [a, b, c] = dice;
  const isTriple = a === c;
  const is456 = a === 4 && b === 5 && c === 6;
  const is123 = a === 1 && b === 2 && c === 3;

  if (is456) {
    return { rank: 5, label: 'シゴロ (4-5-6)', kicker: 6 };
  }

  if (isTriple) {
    return { rank: 4, label: `${a}のゾロ目`, kicker: a };
  }

  if (is123) {
    return { rank: -1, label: 'ヒフミ (1-2-3)', kicker: 0 };
  }

  if (a === b) {
    return { rank: 3, label: `${c}の目`, kicker: c };
  }

  if (b === c) {
    return { rank: 3, label: `${a}の目`, kicker: a };
  }

  return { rank: 0, label: '目なし', kicker: 0 };
}

function determineResult(player, dealer) {
  if (player.rank === 0 && dealer.rank === 0) {
    return 'reroll';
  }

  if (player.rank === 0) return 'dealer';
  if (dealer.rank === 0) return 'player';

  if (player.rank === dealer.rank) {
    if (player.kicker === dealer.kicker) {
      return 'draw';
    }
    return player.kicker > dealer.kicker ? 'player' : 'dealer';
  }

  return player.rank > dealer.rank ? 'player' : 'dealer';
}

function diceToEmoji(dice) {
  return dice.map((value) => DICE_EMOJI[value - 1]).join(' ');
}

function simulateGame() {
  const history = [];
  let outcome;
  let roundData;
  let safetyCounter = 0;

  while (!outcome && safetyCounter < 5) {
    safetyCounter += 1;
    const playerDice = rollDice();
    const dealerDice = rollDice();
    const playerHand = evaluateHand(playerDice);
    const dealerHand = evaluateHand(dealerDice);
    const result = determineResult(playerHand, dealerHand);

    roundData = {
      playerDice,
      dealerDice,
      playerHand,
      dealerHand
    };

    history.push({
      round: safetyCounter,
      data: roundData,
      result
    });

    if (result === 'reroll') {
      continue;
    }

    outcome = result;
  }

  if (!outcome) {
    outcome = 'draw';
  }

  return {
    history,
    outcome,
    finalRound: history.at(-1)
  };
}

function buildEmbed(attempts, outcome, winRate) {
  const colorMap = {
    player: 0x2ecc71,
    dealer: 0xe74c3c,
    draw: 0xf1c40f,
    reroll: 0x3498db
  };

  const finalAttempt = attempts.at(-1);
  const finalData = finalAttempt.finalRound?.data ?? finalAttempt.history[0]?.data;

  const description = [
    `🎲 あなた: ${diceToEmoji(finalData.playerDice)} → **${finalData.playerHand.label}**`,
    `🤖 相手: ${diceToEmoji(finalData.dealerDice)} → **${finalData.dealerHand.label}**`
  ];

  if (outcome === 'reroll') {
    description.push('\n目が揃わなかったためもう一度！');
  }

  const embed = {
    title: 'チンチロリン対決',
    description: description.join('\n'),
    color: colorMap[outcome],
    footer: {
      text:
        (outcome === 'player' ? '勝ち！' : outcome === 'dealer' ? '負け…' : outcome === 'draw' ? '引き分け' : '振り直し') +
        ` | 勝率補正: ${Math.round(winRate * 100)}% | 再挑戦: ${Math.max(attempts.length - 1, 0)}回`
    },
    timestamp: new Date().toISOString()
  };

  if (attempts.length > 1 || finalAttempt.history.length > 1) {
    embed.fields = attempts.map((attempt, index) => ({
      name: index === 0 ? '初回の結果' : `再挑戦${index}`,
      value: attempt.history
        .map(
          (entry) =>
            `第${entry.round}投: ${diceToEmoji(entry.data.playerDice)} vs ${diceToEmoji(entry.data.dealerDice)} → ${entry.data.playerHand.label} / ${entry.data.dealerHand.label}`
        )
        .join('\n')
    }));
  }

  return embed;
}

export default {
  data: new SlashCommandBuilder()
    .setName('chinchiro')
    .setDescription('チンチロリンでボットと勝負！')
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
        await placeBet(interaction.user, betAmount, {
          game: 'chinchiro',
          interactionId: interaction.id
        });
        betPlaced = true;
      }

      const bias = await prepareGameBias(interaction, 'chinchiro');

      const attempts = [];
      let game = simulateGame();
      attempts.push(game);

      if (game.outcome === 'dealer' && bias.rerollChance > 0 && Math.random() < bias.rerollChance) {
        const retry = simulateGame();
        attempts.push(retry);
        game = retry;
      }

      await recordGameOutcome(interaction, 'chinchiro', bias.userRecord, game.outcome);

      if (betPlaced) {
        if (game.outcome === 'player') {
          const payout = betAmount * 2;
          await payoutWin(interaction.user, payout, {
            game: 'chinchiro',
            interactionId: interaction.id,
            originalBet: betAmount
          });
          netChange = betAmount;
        } else if (game.outcome === 'draw') {
          await credit(interaction.user, betAmount, {
            type: TRANSACTION_TYPES.ADJUST,
            reason: 'チンチロ引き分け返金',
            metadata: { game: 'chinchiro', interactionId: interaction.id }
          });
          netChange = 0;
        } else {
          netChange = -betAmount;
        }
      }

      const embed = buildEmbed(attempts, game.outcome, bias.winRate);

      if (betPlaced) {
        const { balance } = await getBalance(interaction.user);
        const summary = `ベット: ${formatCoins(betAmount)} | 収支: ${formatDelta(netChange)} | 残高: ${formatCoins(balance.balance)}`;
        embed.footer.text = `${embed.footer.text} | ${summary}`;
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (betPlaced && netChange === 0 && !(error instanceof CurrencyError)) {
        await credit(interaction.user, betAmount, {
          type: TRANSACTION_TYPES.ADJUST,
          reason: 'システムエラー返金',
          metadata: { game: 'chinchiro', interactionId: interaction.id }
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
