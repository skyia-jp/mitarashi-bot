import {
  getBlackjackSession,
  updateBlackjackSession,
  endBlackjackSession
} from '../../services/casino/blackjackSessionStore.js';
import { buildBlackjackComponents, buildBlackjackEmbed } from '../../services/casino/blackjackPresenter.js';
import { settleBlackjackSession } from '../../services/casino/blackjackFlow.js';
import { hit, stand, doubleDown, BlackjackResult } from '../../services/casino/blackjackService.js';
import { CurrencyError, placeBet, credit, TRANSACTION_TYPES } from '../../services/currencyService.js';

function buildStatusMessage(action, session) {
  if (session.state.finished) {
    if (session.state.result === BlackjackResult.DEALER_WIN) {
      return 'バスト！ディーラーの勝ち…';
    }
    if (session.state.result === BlackjackResult.PLAYER_WIN) {
      return '勝利！';
    }
    if (session.state.result === BlackjackResult.PUSH) {
      return '引き分けです。';
    }
  }

  switch (action) {
    case 'hit':
      return 'ヒットしました。';
    case 'stand':
      return 'スタンドしました。ディーラーの手番です…';
    case 'double':
      return 'ダブルダウンしました。';
    default:
      return null;
  }
}

export default {
  customId: 'blackjack',
  async execute(client, interaction) {
    const segments = interaction.customId.split(':');
    if (segments.length < 3) {
      await interaction.reply({ content: 'ブラックジャックのセッション情報が見つかりませんでした。', ephemeral: true });
      return;
    }

    const [, sessionId, action] = segments;
    const session = getBlackjackSession(sessionId);

    if (!session) {
      await interaction.reply({ content: 'このブラックジャックは既に終了しています。', ephemeral: true });
      return;
    }

    if (session.userId !== interaction.user.id) {
      await interaction.reply({ content: 'このブラックジャックを操作できるのは開始したユーザーのみです。', ephemeral: true });
      return;
    }

    if (session.state.finished) {
      await interaction.reply({ content: 'このブラックジャックはすでに終了しています。', ephemeral: true });
      endBlackjackSession(session.id);
      return;
    }

    let additionalBet = 0;

    if (action === 'double') {
      if (session.state.playerHand.length !== 2 || session.state.actions.length > 0) {
        await interaction.reply({ content: 'ダブルダウンは最初の手番のみ選択できます。', ephemeral: true });
        return;
      }
      if (!session.wager || session.wager.initial <= 0) {
        await interaction.reply({ content: 'ダブルダウンにはベットが必要です。', ephemeral: true });
        return;
      }
      additionalBet = session.state.betAmount ?? session.wager.initial;
      if (additionalBet <= 0) {
        await interaction.reply({ content: '追加ベット額が不正です。', ephemeral: true });
        return;
      }

      try {
        await placeBet(interaction.guild, interaction.user, additionalBet, {
          game: 'blackjack',
          interactionId: interaction.id,
          reason: 'double-down'
        });
      } catch (error) {
        if (error instanceof CurrencyError) {
          await interaction.reply({ content: '💸 残高が不足しています。', ephemeral: true });
          return;
        }
        throw error;
      }
    }

    await interaction.deferUpdate();

    try {
      switch (action) {
        case 'hit':
          hit(session.state);
          break;
        case 'stand':
          stand(session.state);
          break;
        case 'double':
          session.wager.doubleDown = true;
          session.wager.debited = (session.wager.debited ?? 0) + additionalBet;
          session.wager.netChange = (session.wager.netChange ?? 0) - additionalBet;
          doubleDown(session.state);
          break;
        default:
          await interaction.followUp({ content: '未知のアクションです。', ephemeral: true });
          return;
      }
    } catch (error) {
      if (action === 'double' && additionalBet > 0) {
        await credit(interaction.guild, interaction.user, additionalBet, {
          type: TRANSACTION_TYPES.ADJUST,
          reason: 'ダブルダウン失敗返金',
          metadata: { game: 'blackjack', interactionId: interaction.id, sessionId }
        }).catch(() => null);
      }
      throw error;
    }

    let settlement = null;
    if (session.state.finished) {
      settlement = await settleBlackjackSession(interaction, session);
      endBlackjackSession(session.id);
    } else {
      updateBlackjackSession(session.id, () => session);
    }

    const embed = buildBlackjackEmbed(session, {
      revealDealer: session.state.finished,
      statusMessage: buildStatusMessage(action, session),
      balanceInfo: settlement?.balanceInfo
    });
    const components = session.state.finished ? [] : buildBlackjackComponents(session);

    await interaction.editReply({ embeds: [embed], components }).catch(() => null);
  }
};
