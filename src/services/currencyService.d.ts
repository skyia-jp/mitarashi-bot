import type { Guild, User as DiscordUser, Snowflake } from 'discord.js';
import type { User as DbUser, CurrencyBalance, CurrencyTransaction } from '@prisma/client';

export const TRANSACTION_TYPES: {
  EARN: string;
  SPEND: string;
  TRANSFER_IN: string;
  TRANSFER_OUT: string;
  ADJUST: string;
  GAME_BET: string;
  GAME_WIN: string;
  DAILY_BONUS: string;
};

export class CurrencyError extends Error {
  code: string;
  context?: unknown;
  constructor(code: string, message: string, context?: unknown);
}

export type GuildRef = string | { id: string; name?: string } | Guild;
export type DiscordUserRef = DiscordUser | { id: string } | Snowflake;

export interface BalanceResult {
  guildId: string;
  user: DbUser | null;
  balance: number;
  balanceRecord?: CurrencyBalance | null;
}

export interface TransactionResult {
  balance: number;
  balanceRecord?: CurrencyBalance | null;
  transaction?: CurrencyTransaction | null;
}

export function getBalance(guild: GuildRef, discordUser: DiscordUserRef): Promise<BalanceResult>;
export function credit(guild: GuildRef, discordUser: DiscordUserRef, amount: number, options?: { type?: string; reason?: string; metadata?: unknown }): Promise<TransactionResult>;
export function debit(guild: GuildRef, discordUser: DiscordUserRef, amount: number, options?: { type?: string; reason?: string; metadata?: unknown }): Promise<TransactionResult>;
export function transfer(guild: GuildRef, fromUser: DiscordUserRef, toUser: DiscordUserRef, amount: number, options?: { reason?: string; metadata?: unknown }): Promise<TransactionResult>;
export function claimDaily(guild: GuildRef, discordUser: DiscordUserRef): Promise<TransactionResult>;
export function getCooldownInfo(err: unknown): { retryAfter?: number } | null;
export function placeBet(guild: GuildRef, discordUser: DiscordUserRef, amount: number, metadata?: { [key: string]: unknown }): Promise<{ balanceInfo?: { currentBalance: number } } & TransactionResult>;
export function payoutWin(guild: GuildRef, discordUser: DiscordUserRef, amount: number, metadata?: { [key: string]: unknown }): Promise<TransactionResult>;
export function adjustBalanceManually(guild: GuildRef, discordUser: DiscordUserRef, amount: number, options?: { reason?: string; metadata?: unknown }): Promise<TransactionResult>;
