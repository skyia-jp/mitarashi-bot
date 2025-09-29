import { PermissionFlagsBits } from 'discord.js';
import {
  clearWarnings,
  createWarning,
  getWarningTotals,
  listActions,
  listWarnings,
  logAction as persistAction
} from '../database/repositories/moderationRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';
import { getGuildConfig, upsertGuildConfig } from '../database/repositories/guildRepository.js';

export async function ensureLogChannel(interaction, channel) {
  await upsertGuildConfig(interaction.guildId, { logChannelId: channel.id });
  return channel;
}

export async function getLogChannel(guild) {
  const config = await getGuildConfig(guild.id);
  if (!config?.logChannelId) return null;
  return guild.channels.fetch(config.logChannelId).catch(() => null);
}

export async function warnUser(interaction, targetMember, reason, penaltyLevel = 1) {
  const moderator = await getOrCreateUser(interaction.user);
  const target = await getOrCreateUser(targetMember.user);

  const warning = await createWarning({
    guildId: interaction.guildId,
    userId: target.id,
    moderatorId: moderator.id,
    reason,
    penaltyLevel
  });

  await logAction({
    guildId: interaction.guildId,
    userId: target.id,
    moderatorId: moderator.id,
    actionType: 'WARN',
    reason
  });

  const summary = await getWarningSummary(interaction.guildId, targetMember.user.id);
  const logChannel = await getLogChannel(interaction.guild);

  return {
    warning,
    moderator,
    target,
    summary,
    logChannel
  };
}

export function getWarnings(guildId, userDiscordId) {
  return listWarnings(guildId, userDiscordId);
}

export function getActions(guildId, userDiscordId, limit) {
  return listActions(guildId, userDiscordId, limit);
}

export function logAction(data) {
  return persistAction(data);
}

export function canModerate(moderatorMember, targetMember) {
  if (!targetMember) return false;
  if (targetMember.id === moderatorMember.id) return false;
  if (targetMember.roles.highest.position >= moderatorMember.roles.highest.position) return false;
  if (!moderatorMember.permissions.has(PermissionFlagsBits.ModerateMembers)) return false;
  return true;
}

export async function getWarningSummary(guildId, userDiscordId) {
  const [warnings, totals] = await Promise.all([
    listWarnings(guildId, userDiscordId),
    getWarningTotals(guildId, userDiscordId)
  ]);

  const totalPoints = totals._sum.penaltyLevel ?? 0;
  const totalWarnings = totals._count._all ?? 0;

  return {
    warnings,
    totalPoints,
    totalWarnings
  };
}

export async function resetUserWarnings(interaction, targetMember, reason = '警告の初期化') {
  const moderator = await getOrCreateUser(interaction.user);
  const target = await getOrCreateUser(targetMember.user);

  const beforeSummary = await getWarningSummary(interaction.guildId, targetMember.user.id);
  const cleared = await clearWarnings(interaction.guildId, targetMember.user.id);

  await logAction({
    guildId: interaction.guildId,
    userId: target.id,
    moderatorId: moderator.id,
    actionType: 'WARN_RESET',
    reason
  });

  const afterSummary = await getWarningSummary(interaction.guildId, targetMember.user.id);
  const logChannel = await getLogChannel(interaction.guild);

  return {
    moderator,
    target,
    clearedCount: cleared.count,
    beforeSummary,
    afterSummary,
    logChannel
  };
}
