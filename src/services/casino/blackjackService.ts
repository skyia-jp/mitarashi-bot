import { calculateHandValue, createDeck, draw, formatHand, isBlackjack, shuffle } from './cards.js';

const RESULT = {
  PLAYER_WIN: 'player_win',
  DEALER_WIN: 'dealer_win',
  PUSH: 'push'
} as const;

export function createBlackjackGame(options: { deckCount?: number; betAmount?: number } = {}) {
  const deck = shuffle(createDeck(options.deckCount ?? 4));
  const playerHand = draw(deck, 2);
  const dealerHand = draw(deck, 2);

  const state: any = {
    deck,
    playerHand,
    dealerHand,
    playerStood: false,
    finished: false,
    result: null,
    actions: [],
    betAmount: options.betAmount ?? 0,
    initialBlackjack: isBlackjack(playerHand),
    dealerBlackjack: isBlackjack(dealerHand)
  };

  if (state.initialBlackjack || state.dealerBlackjack) {
    state.finished = true;
    if (state.initialBlackjack && state.dealerBlackjack) {
      state.result = RESULT.PUSH;
    } else if (state.initialBlackjack) {
      state.result = RESULT.PLAYER_WIN;
    } else {
      state.result = RESULT.DEALER_WIN;
    }
  }

  return state;
}

export function hit(state: any) {
  if (state.finished || state.playerStood) {
    throw new Error('Cannot hit after standing or finishing the game.');
  }
  const card = draw(state.deck, 1)[0];
  state.playerHand.push(card);
  state.actions.push({ type: 'hit', card });

  const value = calculateHandValue(state.playerHand);
  if (value > 21) {
    state.finished = true;
    state.result = RESULT.DEALER_WIN;
  }

  return state;
}

export function stand(state: any) {
  if (state.finished) {
    throw new Error('Game already finished.');
  }

  state.playerStood = true;
  state.actions.push({ type: 'stand' });

  let dealerValue = calculateHandValue(state.dealerHand);
  while (dealerValue < 17) {
    const card = draw(state.deck, 1)[0];
    state.dealerHand.push(card);
    state.actions.push({ type: 'dealer_hit', card });
    dealerValue = calculateHandValue(state.dealerHand);
  }

  resolve(state);
  return state;
}

export function doubleDown(state: any) {
  if (state.finished || state.playerHand.length !== 2) {
    throw new Error('Double down is only allowed on the first action.');
  }

  state.actions.push({ type: 'double' });
  state.betAmount *= 2;
  const card = draw(state.deck, 1)[0];
  state.playerHand.push(card);
  state.playerStood = true;

  if (calculateHandValue(state.playerHand) > 21) {
    state.finished = true;
    state.result = RESULT.DEALER_WIN;
    return state;
  }

  // Dealer plays out round
  return stand(state);
}

function resolve(state: any) {
  state.finished = true;
  const playerValue = calculateHandValue(state.playerHand);
  const dealerValue = calculateHandValue(state.dealerHand);

  if (playerValue > 21) {
    state.result = RESULT.DEALER_WIN;
    return;
  }
  if (dealerValue > 21) {
    state.result = RESULT.PLAYER_WIN;
    return;
  }
  if (playerValue === dealerValue) {
    state.result = RESULT.PUSH;
    return;
  }
  state.result = playerValue > dealerValue ? RESULT.PLAYER_WIN : RESULT.DEALER_WIN;
}

export function summarize(state: any) {
  const playerValue = calculateHandValue(state.playerHand);
  const dealerValue = calculateHandValue(state.dealerHand);

  return {
    player: {
      hand: state.playerHand,
      value: playerValue,
      text: formatHand(state.playerHand)
    },
    dealer: {
      hand: state.dealerHand,
      value: dealerValue,
      text: formatHand(state.dealerHand)
    },
    result: state.result,
    betAmount: state.betAmount,
    initialBlackjack: state.initialBlackjack,
    dealerBlackjack: state.dealerBlackjack
  };
}

export function getResultPayoutMultiplier(state: any) {
  if (state.initialBlackjack && !state.dealerBlackjack) {
    return 2.5; // 3:2 payout
  }
  switch (state.result) {
    case RESULT.PLAYER_WIN:
      return 2;
    case RESULT.PUSH:
      return 1;
    default:
      return 0;
  }
}

export const BlackjackResult = RESULT;
