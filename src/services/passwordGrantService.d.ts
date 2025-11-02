import type { Guild, GuildMember } from 'discord.js';

export interface PasswordGrantResult {
  ok: boolean;
  alreadyAssigned?: boolean;
  message: string;
}

export function handlePasswordSubmission(guild: Guild, member: GuildMember, password: string): Promise<PasswordGrantResult>;
