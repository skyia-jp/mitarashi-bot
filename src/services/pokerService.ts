import { randomInt } from 'node:crypto';

const SUITS = [
  { key: 'spades', symbol: '♠', color: 0x2ecc71 },
  { key: 'hearts', symbol: '♥', color: 0xe74c3c },
  { key: 'diamonds', symbol: '♦', color: 0xf1c40f },
  { key: 'clubs', symbol: '♣', color: 0x3498db }
];

const RANKS = [
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: 'J', value: 11 },
  { label: 'Q', value: 12 },
  { label: 'K', value: 13 },
  { label: 'A', value: 14 }
];

const VALUE_TO_LABEL = new Map(RANKS.map((rank) => [rank.value, rank.label]));

const HAND_RANKS = {
  highCard: { rank: 0, label: 'ハイカード' },
  onePair: { rank: 1, label: 'ワンペア' },
  twoPair: { rank: 2, label: 'ツーペア' },
  threeOfKind: { rank: 3, label: 'スリーカード' },
  straight: { rank: 4, label: 'ストレート' },
  flush: { rank: 5, label: 'フラッシュ' },
  fullHouse: { rank: 6, label: 'フルハウス' },
  fourOfKind: { rank: 7, label: 'フォーカード' },
  straightFlush: { rank: 8, label: 'ストレートフラッシュ' }
} as const;

type Suit = { key: string; symbol: string; color: number };
type Rank = { label: string; value: number };
type Card = { suit: Suit; rank: Rank; value: number };

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        value: rank.value
      });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawHand(deck: Card[], size = 5) {
  return deck.splice(0, size);
}

function detectStraight(values: number[]) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length !== 5) {
    return { isStraight: false } as const;
  }

  const highest = unique[0];
  let sequential = true;
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] !== highest - i) {
      sequential = false;
      break;
    }
  }

  if (sequential) {
    return {
      isStraight: true,
      high: highest,
      sequence: unique
    } as const;
  }

  const wheel = unique.map((value) => (value === 14 ? 1 : value)).sort((a, b) => b - a);
  const isWheel = wheel[0] === 5 && wheel[1] === 4 && wheel[2] === 3 && wheel[3] === 2 && wheel[4] === 1;

  if (isWheel) {
    return {
      isStraight: true,
      high: 5,
      sequence: [5, 4, 3, 2, 1]
    } as const;
  }

  return { isStraight: false } as const;
}

function toStrengthArray(entries: [number, number][], excludeValue: number | null = null) {
  return entries
    .filter(([value]) => value !== excludeValue)
    .map(([value]) => value)
    .sort((a, b) => b - a);
}

export function evaluateHand(hand: Card[]) {
  const sorted = [...hand].sort((a, b) => b.value - a.value);
  const values = sorted.map((card) => card.value);
  const suits = sorted.map((card) => card.suit.key);
  const isFlush = suits.every((suit) => suit === suits[0]);

  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const entries = [...counts.entries()].sort((a, b) => {
    if (b[1] === a[1]) {
      return b[0] - a[0];
    }
    return b[1] - a[1];
  });

  const straightInfo = detectStraight(values);

  if (straightInfo.isStraight && isFlush) {
    const label = straightInfo.high === 14 ? 'ロイヤルフラッシュ' : HAND_RANKS.straightFlush.label;
    return {
      rank: HAND_RANKS.straightFlush.rank,
      label,
      strength: straightInfo.sequence
    };
  }

  if (entries[0][1] === 4) {
    const four = entries[0][0];
    const kicker = entries[1][0];
    return {
      rank: HAND_RANKS.fourOfKind.rank,
      label: HAND_RANKS.fourOfKind.label,
      strength: [four, kicker]
    };
  }

  if (entries[0][1] === 3 && entries[1]?.[1] === 2) {
    const triple = entries[0][0];
    const pair = entries[1][0];
    return {
      rank: HAND_RANKS.fullHouse.rank,
      label: HAND_RANKS.fullHouse.label,
      strength: [triple, pair]
    };
  }

  if (isFlush) {
    return {
      rank: HAND_RANKS.flush.rank,
      label: HAND_RANKS.flush.label,
      strength: values
    };
  }

  if (straightInfo.isStraight) {
    return {
      rank: HAND_RANKS.straight.rank,
      label: HAND_RANKS.straight.label,
      strength: straightInfo.sequence
    };
  }

  if (entries[0][1] === 3) {
    const triple = entries[0][0];
    const kickers = toStrengthArray(entries, triple);
    return {
      rank: HAND_RANKS.threeOfKind.rank,
      label: HAND_RANKS.threeOfKind.label,
      strength: [triple, ...kickers]
    };
  }

  if (entries[0][1] === 2 && entries[1]?.[1] === 2) {
    const pairValues = entries
      .filter((entry) => entry[1] === 2)
      .map((entry) => entry[0])
      .sort((a, b) => b - a);
    const kicker = entries.find((entry) => entry[1] === 1)?.[0] ?? 0;
    return {
      rank: HAND_RANKS.twoPair.rank,
      label: HAND_RANKS.twoPair.label,
      strength: [...pairValues, kicker]
    };
  }

  if (entries[0][1] === 2) {
    const pairValue = entries[0][0];
    const kickers = toStrengthArray(entries, pairValue);
    return {
      rank: HAND_RANKS.onePair.rank,
      label: HAND_RANKS.onePair.label,
      strength: [pairValue, ...kickers]
    };
  }

  return {
    rank: HAND_RANKS.highCard.rank,
    label: HAND_RANKS.highCard.label,
    strength: values
  };
}

export function compareHands(player: any, dealer: any) {
  if (player.rank !== dealer.rank) {
    return player.rank > dealer.rank ? 1 : -1;
  }

  const length = Math.max(player.strength.length, dealer.strength.length);
  for (let i = 0; i < length; i += 1) {
    const playerValue = player.strength[i] ?? 0;
    const dealerValue = dealer.strength[i] ?? 0;
    if (playerValue === dealerValue) continue;
    return playerValue > dealerValue ? 1 : -1;
  }

  return 0;
}

export function formatHand(hand: Card[]) {
  return hand
    .map((card) => `${card.rank.label}${card.suit.symbol}`)
    .join(' ');
}

export function valueToLabel(value: number) {
  if (value === 1) return 'A';
  return VALUE_TO_LABEL.get(value) ?? String(value);
}

export function calculateEmbedColor(result: string) {
  if (result === 'player') return 0x2ecc71;
  if (result === 'dealer') return 0xe74c3c;
  return 0xf1c40f;
}

function dealPokerRound() {
  const deck = shuffleDeck(buildDeck());
  const playerHand = drawHand(deck);
  const dealerHand = drawHand(deck);
  const playerEvaluation = evaluateHand(playerHand);
  const dealerEvaluation = evaluateHand(dealerHand);
  const comparison = compareHands(playerEvaluation, dealerEvaluation);

  const result = comparison === 0 ? 'draw' : comparison > 0 ? 'player' : 'dealer';

  return {
    player: {
      hand: playerHand,
      evaluation: playerEvaluation
    },
    dealer: {
      hand: dealerHand,
      evaluation: dealerEvaluation
    },
    result
  };
}

export function playPoker({ maxDrawRetries = 5 } = {}) {
  let attempts = 0;
  let gameResult: any = null;

  do {
    attempts += 1;
    gameResult = dealPokerRound();
  } while (gameResult.result === 'draw' && attempts < maxDrawRetries);

  return gameResult;
}
