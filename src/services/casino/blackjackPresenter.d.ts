import type { APIEmbed } from 'discord.js';

export type BlackjackAction = { type: 'hit' | 'stand' | 'double' | 'dealer_hit'; card?: any };

export type BlackjackState = {
  deck: any[];
  playerHand: any[];
  dealerHand: any[];
  playerStood: boolean;
  finished: boolean;
  result: string | null;
  actions: BlackjackAction[];
  betAmount: number;
  initialBlackjack: boolean;
  dealerBlackjack: boolean;
};

export type BlackjackWager = {
  initial: number;
  debited?: number;
  netChange?: number;
  doubleDown?: boolean;
  settled?: boolean;
};

export type BlackjackBias = {
  winRate?: number;
  rerollChance?: number;
  userRecord?: any;
};

export type BlackjackSession = {
  id: string;
  userId: string;
  guildId?: string | null;
  channelId?: string | null;
  interactionId?: string | null;
  createdAt?: number;
  expiresAt?: number;
  messageId?: string | null;
  state: BlackjackState;
  wager?: BlackjackWager;
  bias?: BlackjackBias;
};

export type BlackjackEmbedOptions = {
  revealDealer?: boolean;
  statusMessage?: string | null | undefined;
  balanceInfo?: { currentBalance?: number } | null;
};

export function buildBlackjackEmbed(session: BlackjackSession, opts?: BlackjackEmbedOptions): APIEmbed;
export function buildBlackjackComponents(session: BlackjackSession): any[];
export function resultToOutcome(result: string): 'player' | 'dealer' | 'draw' | 'progress';
