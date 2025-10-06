import { randomInt } from 'node:crypto';

const SUITS = [
  { key: 'spades', symbol: '♠' },
  { key: 'hearts', symbol: '♥' },
  { key: 'diamonds', symbol: '♦' },
  { key: 'clubs', symbol: '♣' }
];

const RANKS = [
  { label: 'A', value: 11 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: 'J', value: 10 },
  { label: 'Q', value: 10 },
  { label: 'K', value: 10 }
];

export function createDeck(deckCount = 4) {
  const deck = [];
  for (let i = 0; i < deckCount; i += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, value: rank.value });
      }
    }
  }
  return deck;
}

export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function draw(deck, count = 1) {
  return deck.splice(0, count);
}

export function formatHand(cards, hideHole = false) {
  if (hideHole) {
    const [first, ...rest] = cards;
    return [`${first.rank.label}${first.suit.symbol}`, ...rest.map(() => '🂠')].join(' ');
  }
  return cards.map((card) => `${card.rank.label}${card.suit.symbol}`).join(' ');
}

export function calculateHandValue(cards) {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    total += card.value;
    if (card.rank.label === 'A') {
      aceCount += 1;
    }
  }

  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount -= 1;
  }

  return total;
}

export function isBlackjack(cards) {
  return cards.length === 2 && calculateHandValue(cards) === 21;
}
