import crypto from 'node:crypto';
import { getGuildConfig, upsertGuildConfig } from '../database/repositories/guildRepository.js';
import { createModuleLogger } from '../utils/logger.js';

const passwordAuthLogger = createModuleLogger('service:password-auth');

function hashPasswordValue(value: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('パスワードが空です。');
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function toBufferFromHex(hex: string) {
  return Buffer.from(hex, 'hex');
}

function normalizeHint(hint: unknown) {
  if (typeof hint !== 'string') return null;
  const trimmed = hint.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getPasswordAuthConfig(guildId: string | number) {
  return getGuildConfig(guildId as any);
}

export async function setPasswordAuthConfig(guildId: string | number, { password, roleId, hint }: { password: string; roleId: string | null; hint?: string | null }) {
  if (!roleId) throw new Error('ロールが指定されていません。');

  const passwordHash = hashPasswordValue(password);
  const update = {
    passwordAuthRoleId: roleId,
    passwordAuthSecretHash: passwordHash,
    passwordAuthHint: normalizeHint(hint),
    passwordAuthUpdatedAt: new Date()
  };

  await upsertGuildConfig(guildId as any, update);

  passwordAuthLogger.info(
    {
      event: 'password_auth.config.set',
      guild_id: guildId,
      role_id: roleId
    },
    'Password auth settings updated'
  );

  return update;
}

export async function clearPasswordAuthConfig(guildId: string | number) {
  const update = {
    passwordAuthRoleId: null,
    passwordAuthSecretHash: null,
    passwordAuthHint: null,
    passwordAuthUpdatedAt: new Date()
  };

  await upsertGuildConfig(guildId as any, update);

  passwordAuthLogger.info(
    {
      event: 'password_auth.config.cleared',
      guild_id: guildId
    },
    'Password auth settings cleared'
  );

  return update;
}

export async function isPasswordAuthConfigured(guildId: string | number) {
  const config = await getGuildConfig(guildId as any);
  return Boolean(config?.passwordAuthRoleId && config?.passwordAuthSecretHash);
}

export async function verifyPassword(guildId: string | number, password: string) {
  if (typeof password !== 'string' || password.length === 0) return { success: false, config: null };

  const config = await getGuildConfig(guildId as any);
  if (!config?.passwordAuthSecretHash) return { success: false, config };

  const candidateHash = hashPasswordValue(password);
  const storedBuffer = toBufferFromHex(config.passwordAuthSecretHash);
  const candidateBuffer = toBufferFromHex(candidateHash);

  if (storedBuffer.length !== candidateBuffer.length) return { success: false, config };

  const success = crypto.timingSafeEqual(storedBuffer, candidateBuffer);
  return { success, config };
}

export function buildPasswordAuthStatus(config: any) {
  if (!config?.passwordAuthRoleId || !config.passwordAuthSecretHash) {
    return {
      configured: false,
      roleId: null,
      hint: null,
      updatedAt: config?.passwordAuthUpdatedAt ?? null
    };
  }

  return {
    configured: true,
    roleId: config.passwordAuthRoleId,
    hint: config.passwordAuthHint ?? null,
    updatedAt: config.passwordAuthUpdatedAt ?? null
  };
}
