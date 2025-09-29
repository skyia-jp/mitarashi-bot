import { SlashCommandBuilder } from 'discord.js';
import { prepareGameBias, recordGameOutcome } from '../../services/gameBiasService.js';

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
    .setDescription('チンチロリンでボットと勝負！'),
  async execute(client, interaction) {
    await interaction.deferReply();
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

    const embed = buildEmbed(attempts, game.outcome, bias.winRate);
    await interaction.editReply({ embeds: [embed] });
  }
};
