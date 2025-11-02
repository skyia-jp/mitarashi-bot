import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importRecursively } from '../src/utils/fileLoader.ts';
import logger from '../src/utils/logger.ts';

const token = process.env.DISCORD_BOT_TOKEN as string | undefined;
const clientId = process.env.DISCORD_CLIENT_ID as string | undefined;
const guildId = process.env.DISCORD_GUILD_ID as string | undefined;
const debugCommandDiff = (process.env.DEBUG_COMMAND_DIFF ?? 'false').toLowerCase() === 'true';

if (!token || !clientId) {
  throw new Error('DISCORD_BOT_TOKEN と DISCORD_CLIENT_ID を設定してください。');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function collectCommands(): Promise<any[]> {
  const commandsDir = path.join(__dirname, '..', 'src', 'commands');
  const modules: any[] = await importRecursively(commandsDir);
  logger.info({ files: modules.map((m: any) => m.filePath) }, 'collectCommands: imported command modules');
  return modules
    .map(({ module }: any) => module.default ?? module.command)
    .filter((command) => command?.data)
    .map((command) => command.data.toJSON());
}

function formatCommandList(commands: any[] = []): any[] {
  return commands.map((command: any) => ({
    id: command.id,
    name: command.name,
    description: command.description,
    type: command.type ?? 1
  }));
}

function normalizeForComparison(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((v) => normalizeForComparison(v)).filter((v) => v !== undefined);
  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      const normalized = normalizeForComparison(value[key]);
      if (normalized !== undefined) result[key] = normalized;
    }
    return result;
  }
  return value;
}

function stableStringify(value: any): string {
  return JSON.stringify(normalizeForComparison(value));
}

function toComparableChoice(choice: any = {}): any {
  return normalizeForComparison({
    name: choice.name,
    name_localizations: choice.name_localizations ?? null,
    value: choice.value
  });
}

function toComparableOption(option: any = {}): any {
  return normalizeForComparison({
    type: option.type,
    name: option.name,
    name_localizations: option.name_localizations ?? null,
    description: option.description ?? null,
    description_localizations: option.description_localizations ?? null,
    required: option.required ?? false,
    choices: (option.choices ?? []).map(toComparableChoice),
    options: (option.options ?? []).map(toComparableOption),
    channel_types: option.channel_types ?? null,
    min_value: option.min_value ?? null,
    max_value: option.max_value ?? null,
    min_length: option.min_length ?? null,
    max_length: option.max_length ?? null,
    autocomplete: option.autocomplete ?? false
  });
}

function toComparableCommand(command: any = {}): any {
  const hasDmPermission = Object.prototype.hasOwnProperty.call(command, 'dm_permission');
  let dmPermission = hasDmPermission ? command.dm_permission ?? null : null;
  if (dmPermission === true) dmPermission = null;

  let integrationTypes = command.integration_types ?? null;
  if (Array.isArray(integrationTypes)) {
    const normalizedTypes = Array.from(new Set(integrationTypes)).sort();
    if (normalizedTypes.length === 2 && normalizedTypes[0] === 0 && normalizedTypes[1] === 1) {
      integrationTypes = null;
    } else {
      integrationTypes = normalizedTypes;
    }
  }

  let contexts = command.contexts ?? null;
  if (Array.isArray(contexts)) {
    const normalizedContexts = Array.from(new Set(contexts)).sort();
    if (normalizedContexts.length === 3 && normalizedContexts[0] === 0 && normalizedContexts[1] === 1 && normalizedContexts[2] === 2) {
      contexts = null;
    } else {
      contexts = normalizedContexts;
    }
  }

  return normalizeForComparison({
    type: command.type ?? 1,
    name: command.name,
    name_localizations: command.name_localizations ?? null,
    description: command.description ?? null,
    description_localizations: command.description_localizations ?? null,
    options: (command.options ?? []).map(toComparableOption),
    default_member_permissions: command.default_member_permissions ?? null,
    dm_permission: dmPermission,
    nsfw: command.nsfw ?? false,
    integration_types: integrationTypes,
    contexts
  });
}

function computeSignatureFromCommand(command: any): string {
  return stableStringify(toComparableCommand(command));
}

async function wipeScope(rest: any, route: any, scopeLabel: string, extraLog: Record<string, any> = {}): Promise<void> {
  const existing: any[] = await rest.get(route);
  if (!existing || existing.length === 0) {
    logger.info({ scope: scopeLabel, ...extraLog }, `${scopeLabel}に削除対象のコマンドはありません`);
    return;
  }

  logger.warn(
    {
      scope: scopeLabel,
      count: existing.length,
      commands: formatCommandList(existing),
      ...extraLog
    },
    `${scopeLabel}のコマンドを全削除します`
  );
  await rest.put(route, { body: [] });
  logger.warn({ scope: scopeLabel, ...extraLog }, `${scopeLabel}のコマンドを全削除しました`);
}

async function syncScopeDifferential(rest: any, routes: any, scopeLabel: string, commands: any[], extraLog: Record<string, any> = {}): Promise<void> {
  const existing: any[] = await rest.get(routes.list);
  logger.info(
    {
      scope: scopeLabel,
      count: existing.length,
      commands: formatCommandList(existing),
      ...extraLog
    },
    `${scopeLabel}の既存コマンド一覧`
  );

  if (!Array.isArray(commands) || commands.length === 0) {
    logger.info({ scope: scopeLabel, ...extraLog }, `${scopeLabel}に登録するコマンドが無いため同期をスキップしました`);
    return;
  }

  const existingByName = new Map((existing ?? []).map((command: any) => [command.name, { command, signature: computeSignatureFromCommand(command) }]));
  const created: any[] = [];
  const updated: any[] = [];
  const deleted: any[] = [];
  const unchanged: any[] = [];

  for (const command of commands) {
    const current = existingByName.get(command.name);
    if (!current) {
      created.push(command);
      continue;
    }

    const nextSignature = computeSignatureFromCommand(command);
    if (current.signature === nextSignature) {
      unchanged.push(current.command);
    } else {
      if (debugCommandDiff) {
        logger.debug({ scope: scopeLabel, name: command.name, before: toComparableCommand(current.command), after: toComparableCommand(command), ...extraLog }, 'Slash command detected difference');
      }
      updated.push(command);
    }

    existingByName.delete(command.name);
  }

  for (const entry of existingByName.values()) {
    deleted.push(entry.command);
  }

  if (created.length === 0 && updated.length === 0 && deleted.length === 0) {
    logger.info({ scope: scopeLabel, unchanged: formatCommandList(unchanged), ...extraLog }, `${scopeLabel}のコマンドは変更が無いため更新をスキップしました`);
    return;
  }

  const dryRun = (process.env.DRY_RUN ?? 'false').toLowerCase() === 'true';
  const allowDeleteOld = (process.env.ALLOW_DELETE_OLD ?? 'false').toLowerCase() === 'true';

  if (dryRun) {
    logger.warn({ scope: scopeLabel, created: formatCommandList(created), updated: formatCommandList(updated), deleted: formatCommandList(deleted) }, `${scopeLabel}のコマンド同期は DRY_RUN のため実行されませんでした`);
    return;
  }

  if (deleted.length > 0 && !allowDeleteOld) {
    logger.warn({ scope: scopeLabel, deleted: formatCommandList(deleted) }, `${scopeLabel}にて削除対象のコマンドが存在します。失われる可能性のあるコマンドを自動で削除しないようにするには環境変数 ALLOW_DELETE_OLD=true を設定してください`);
    // Still allow creates/updates by performing a partial update: create/update only
    // Build the payload by taking existing commands, removing only those that exactly match updated/created names,
    // but preserve commands that would otherwise be deleted. This prevents accidental removal of commands with name changes.
    const existingAfter = (existing ?? []).map((c: any) => ({ ...c }));
    // Names to ensure present (created or updated)
    const ensureNames = new Set([...created.map((c) => c.name), ...updated.map((c) => c.name)]);
    // Replace or add ensured commands
    const merged = existingAfter.filter((c: any) => !ensureNames.has(c.name));
    merged.push(...created, ...updated);
    const afterDeploy = await rest.put(routes.list, { body: merged });
    logger.info({ scope: scopeLabel, created: formatCommandList(created), updated: formatCommandList(updated), preserved: formatCommandList(existingAfter.filter((c: any) => !ensureNames.has(c.name))), totalAfter: formatCommandList(afterDeploy), ...extraLog }, `${scopeLabel}のコマンド同期が部分的に完了しました（削除は保留）`);
    return;
  }

  const afterDeploy = await rest.put(routes.list, { body: commands });

  // Post-deploy verification: fetch list and assert the expected created/ deleted states
  try {
    const verify = await rest.get(routes.list);
    const names = new Set((verify ?? []).map((c: any) => c.name));
    const missingCreated = created.filter((c) => !names.has(c.name));
    const stillPresentDeleted = deleted.filter((c) => names.has(c.name));
    if (missingCreated.length > 0 || stillPresentDeleted.length > 0) {
      logger.error({ scope: scopeLabel, missingCreated: formatCommandList(missingCreated), stillPresentDeleted: formatCommandList(stillPresentDeleted) }, `${scopeLabel}のポストデプロイ検証で不整合が見つかりました`);
    } else {
      logger.info({ scope: scopeLabel, created: formatCommandList(created), updated: formatCommandList(updated), deleted: formatCommandList(deleted), unchanged: formatCommandList(unchanged), totalAfter: formatCommandList(afterDeploy), ...extraLog }, `${scopeLabel}のコマンド差分同期が完了しました`);
    }
  } catch (err) {
    logger.warn({ scope: scopeLabel, err }, `${scopeLabel}のポストデプロイ検証に失敗しました（検証は継続します）`);
    logger.info({ scope: scopeLabel, created: formatCommandList(created), updated: formatCommandList(updated), deleted: formatCommandList(deleted), unchanged: formatCommandList(unchanged), totalAfter: formatCommandList(afterDeploy), ...extraLog }, `${scopeLabel}のコマンド差分同期が完了しました`);
  }
}

async function main(): Promise<void> {
  const commands = await collectCommands();
  const rest: any = new REST({ version: '10' }).setToken(token as string);

  try {
    const deployGlobalEnv = process.env.DEPLOY_GLOBAL ?? 'true';
    const shouldDeployGlobal = deployGlobalEnv.toLowerCase() === 'true';
    const deployGuildEnv = process.env.DEPLOY_GUILD ?? 'false';
    const shouldDeployGuild = Boolean(guildId) && deployGuildEnv.toLowerCase() === 'true';
    const wipeAllEnv = process.env.WIPE_ALL_COMMANDS ?? 'false';
    const shouldWipeAll = wipeAllEnv.toLowerCase() === 'true';

    const globalRoutes = { list: Routes.applicationCommands(clientId as string) };

    if (shouldDeployGlobal) {
      if (shouldWipeAll) {
        await wipeScope(rest, globalRoutes.list, 'グローバル');
      } else {
        await syncScopeDifferential(rest, globalRoutes, 'グローバル', commands);
      }
    } else if (shouldWipeAll) {
      await wipeScope(rest, globalRoutes.list, 'グローバル');
    } else {
      logger.info({ scope: 'グローバル', deployGlobalEnv }, '環境設定によりグローバルコマンドの同期をスキップしました');
    }

    if (shouldDeployGuild) {
      const guildRoutes = { list: Routes.applicationGuildCommands(clientId as string, guildId as string) };
      if (shouldWipeAll) {
        await wipeScope(rest, guildRoutes.list, 'ギルド', { guildId });
      } else {
        await syncScopeDifferential(rest, guildRoutes, 'ギルド', commands, { guildId });
      }
    } else if (guildId) {
      if (shouldWipeAll) {
        await wipeScope(rest, Routes.applicationGuildCommands(clientId as string, guildId as string), 'ギルド', { guildId });
      }
      logger.info({ guildId, deployGuildEnv }, '環境設定によりギルドコマンドの同期をスキップしました');
    } else {
      logger.info('DISCORD_GUILD_ID が設定されていないため、ギルドコマンドの同期はスキップしました');
    }
  } catch (error) {
    logger.error({ err: error }, 'スラッシュコマンドのデプロイに失敗しました');
  }
}

main();

