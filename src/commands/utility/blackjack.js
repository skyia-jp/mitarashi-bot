import { SlashCommandBuilder } from 'discord.js';
import {
  BlackjackResult,
  createBlackjackGame
} from '../../services/casino/blackjackService.js';
import {
  buildBlackjackComponents,
  buildBlackjackEmbed
} from '../../services/casino/blackjackPresenter.js';
import {
  attachMessageToSession,
  createBlackjackSession,
  endBlackjackSession,
  getActiveBlackjackSessionForUser
} from '../../services/casino/blackjackSessionStore.js';
import { settleBlackjackSession } from '../../services/casino/blackjackFlow.js';
import { placeBet, credit, CurrencyError, TRANSACTION_TYPES } from '../../services/currencyService.js';
import { prepareGameBias } from '../../services/gameBiasService.js';

const intl = new Intl.NumberFormat('ja-JP');

function formatCoins(amount) {
  return `${intl.format(amount)} MITACoin`;
}

const DECK_COUNT = 6;

function createGameWithBias(betAmount, bias) {
  let game = createBlackjackGame({ betAmount, deckCount: DECK_COUNT });

  if (
    bias?.rerollChance > 0 &&
    game.finished &&
    game.result === BlackjackResult.DEALER_WIN &&
    !game.dealerBlackjack &&
    Math.random() < bias.rerollChance
  ) {
    game = createBlackjackGame({ betAmount, deckCount: DECK_COUNT });
  }

  return game;
}

export default {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('ブラックジャックでボットと勝負！')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('賭ける MITACoin の額 (任意)')
        .setMinValue(1)
    ),
  async execute(client, interaction) {
    await interaction.deferReply();

    const existing = getActiveBlackjackSessionForUser(interaction.guildId, interaction.user.id);
    if (existing) {
      await interaction.editReply({
        content: '現在進行中のブラックジャックが存在します。前のゲームを完了するまで少しお待ちください。'
      });
      return;
    }

    const betAmount = interaction.options.getInteger('bet') ?? 0;
    let betPlaced = false;

    try {
      if (betAmount > 0) {
        await placeBet(interaction.user, betAmount, {
          game: 'blackjack',
          interactionId: interaction.id
        });
        betPlaced = true;
      }

      const bias = await prepareGameBias(interaction, 'blackjack').catch(() => null);
      const game = createGameWithBias(betAmount, bias);

      const session = createBlackjackSession({
        userId: interaction.user.id,
        guildId: interaction.guildId ?? null,
        channelId: interaction.channelId ?? null,
        interactionId: interaction.id,
        state: game,
        wager: {
          initial: betAmount,
          debited: betAmount > 0 ? betAmount : 0,
          netChange: betAmount > 0 ? -betAmount : 0,
          doubleDown: false,
          settled: false
        },
        bias
      });

      let balanceInfo = null;
      if (game.finished) {
        const settlement = await settleBlackjackSession(interaction, session);
        balanceInfo = settlement.balanceInfo;
        session.wager.settled = true;
        endBlackjackSession(session.id);
      }

      const embed = buildBlackjackEmbed(session, {
        revealDealer: game.finished,
        statusMessage: game.finished ? undefined : 'ヒット / スタンド / ダブルダウンを選択してください。',
        balanceInfo
      });
      const components = game.finished ? [] : buildBlackjackComponents(session);

      const reply = await interaction.editReply({
        embeds: [embed],
        components
      });

      if (!game.finished) {
        attachMessageToSession(session.id, reply.id);
      }
    } catch (error) {
      if (betPlaced) {
        await credit(interaction.user, betAmount, {
          type: TRANSACTION_TYPES.ADJUST,
          reason: 'ブラックジャック初期化エラー返金',
          metadata: { game: 'blackjack', interactionId: interaction.id }
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
