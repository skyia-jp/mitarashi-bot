import { PermissionFlagsBits } from 'discord.js';
import { verifyPassword } from './passwordAuthService.js';
import { createModuleLogger } from '../utils/logger.js';

const passwordGrantLogger = createModuleLogger('service:password-grant');

async function fetchRole(guild, roleId) {
  if (!roleId) {
    return null;
  }

  return guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
}

async function ensureBotCanAssignRole(guild, role) {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Botに「ロールの管理」権限が無いため、ロールを付与できません。');
  }

  if (role.position >= me.roles.highest.position) {
    throw new Error('設定されたロールがBotより上位にあるため付与できません。管理者にロールの位置を確認してください。');
  }
}

export async function handlePasswordSubmission(guild, member, password) {
  const { success, config } = await verifyPassword(guild.id, password);

  if (!config?.passwordAuthRoleId || !config.passwordAuthSecretHash) {
    return {
      ok: false,
      message: '現在、パスワード認証によるロール付与は設定されていません。管理者にお問い合わせください。'
    };
  }

  if (!success) {
    const hint = config.passwordAuthHint ? `\nヒント: ${config.passwordAuthHint}` : '';
    return {
      ok: false,
      message: `パスワードが一致しませんでした。${hint}`.trim()
    };
  }

  const role = await fetchRole(guild, config.passwordAuthRoleId);

  if (!role) {
    return {
      ok: false,
      message: '設定されたロールが見つかりませんでした。管理者に確認を依頼してください。'
    };
  }

  try {
    await ensureBotCanAssignRole(guild, role);
  } catch (error) {
    return {
      ok: false,
      message: error.message
    };
  }

  if (member.roles.cache.has(role.id)) {
    return {
      ok: true,
      alreadyAssigned: true,
      message: `既に ${role} が付与されています。`
    };
  }

  try {
    await member.roles.add(role, 'Password authenticated role assignment');
  } catch (error) {
    passwordGrantLogger.error(
      {
        err: error,
        event: 'password_grant.role.assign.error',
        guild_id: guild.id,
        role_id: role.id,
        member_id: member.id
      },
      'Failed to assign password auth role'
    );
    return {
      ok: false,
      message: 'ロールの付与に失敗しました。Botの権限やロールの位置を確認してください。'
    };
  }

  return {
    ok: true,
    alreadyAssigned: false,
    message: `${role} を付与しました。ようこそ！`
  };
}
