import { getBalance, credit, payoutWin, TRANSACTION_TYPES } from '../currencyService.js';
import { BlackjackResult, getResultPayoutMultiplier } from './blackjackService.js';
import { resultToOutcome } from './blackjackPresenter.js';
import { recordGameOutcome } from '../gameBiasService.js';

function calculatePayout(session) {
  const totalBet = session.state.betAmount ?? 0;
  if (totalBet <= 0) {
    return { payout: 0, totalBet: 0 };
  }

  if (session.state.initialBlackjack && !session.state.dealerBlackjack) {
    const base = session.wager?.initial ?? totalBet;
    const payout = Math.floor((base * 5) / 2);
    return { payout, totalBet: base };
  }

  const multiplier = getResultPayoutMultiplier(session.state);
  return { payout: Math.round(totalBet * multiplier), totalBet };
}

export async function settleBlackjackSession(interaction, session) {
  const { payout, totalBet } = calculatePayout(session);
  const debited = session.wager?.debited ?? totalBet;
  let netChange = -debited;

  if (session.state.result === BlackjackResult.PLAYER_WIN) {
    if (payout > 0) {
      await payoutWin(interaction.user, payout, {
        game: 'blackjack',
        interactionId: interaction.id,
        sessionId: session.id,
        totalBet
      });
      netChange = payout - debited;
    } else {
      netChange = -debited;
    }
  } else if (session.state.result === BlackjackResult.PUSH) {
    if (totalBet > 0) {
      await credit(interaction.user, totalBet, {
        type: TRANSACTION_TYPES.ADJUST,
        reason: 'ブラックジャック引き分け返金',
        metadata: {
          game: 'blackjack',
          interactionId: interaction.id,
          sessionId: session.id
        }
      });
    }
    netChange = 0;
  }

  if (session.wager) {
    session.wager.debited = debited;
    session.wager.netChange = netChange;
    session.wager.payout = payout;
    session.wager.settled = true;
  }

  const balance = await getBalance(interaction.user).catch(() => null);

  await recordGameOutcome(interaction, 'blackjack', session.bias?.userRecord, resultToOutcome(session.state.result));

  return {
    payout,
    totalBet,
    netChange,
    balanceInfo: balance ? { currentBalance: balance.balance.balance } : null
  };
}
