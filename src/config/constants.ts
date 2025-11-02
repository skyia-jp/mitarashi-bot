export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Tokyo';
export const OWNER_IDS: string[] = (process.env.OWNER_IDS || '').split(',').filter(Boolean);
export const GUILD_ID: string | null = process.env.DISCORD_GUILD_ID || null;
