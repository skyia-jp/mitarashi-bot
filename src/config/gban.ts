const BLACKLISTED_GUILDS = ['1419379767664316619'];

export const isGuildBlacklisted = (guildId: string) => BLACKLISTED_GUILDS.includes(guildId);

export default BLACKLISTED_GUILDS;
