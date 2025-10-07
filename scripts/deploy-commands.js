import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importRecursively } from '../src/utils/fileLoader.js';
import logger from '../src/utils/logger.js';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const debugCommandDiff = (process.env.DEBUG_COMMAND_DIFF ?? 'false').toLowerCase() === 'true';

if (!token || !clientId) {
  throw new Error('DISCORD_BOT_TOKEN と DISCORD_CLIENT_ID を設定してください。');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function collectCommands() {
  const commandsDir = path.join(__dirname, '..', 'src', 'commands');
  const modules = await importRecursively(commandsDir);
  return modules
    .map(({ module }) => module.default ?? module.command)
    .filter((command) => command?.data)
    .map((command) => command.data.toJSON());
}

function formatCommandList(commands) {
  return (commands ?? []).map((command) => ({
    id: command.id,
    name: command.name,
    description: command.description,
    type: command.type ?? 1
  }));
}

function normalizeForComparison(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeForComparison(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const result = {};
    const keys = Object.keys(value).sort();

    for (const key of keys) {
      const normalized = normalizeForComparison(value[key]);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }

    return result;
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeForComparison(value));
}

function toComparableChoice(choice = {}) {
  return normalizeForComparison({
    name: choice.name,
    name_localizations: choice.name_localizations ?? null,
    value: choice.value
  });
}

function toComparableOption(option = {}) {
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

function toComparableCommand(command = {}) {
  const hasDmPermission = Object.prototype.hasOwnProperty.call(command, 'dm_permission');
  let dmPermission = hasDmPermission ? command.dm_permission ?? null : null;
  if (dmPermission === true) {
    dmPermission = null;
  }

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
    if (
      normalizedContexts.length === 3 &&
      normalizedContexts[0] === 0 &&
      normalizedContexts[1] === 1 &&
      normalizedContexts[2] === 2
    ) {
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

function computeSignatureFromCommand(command) {
  return stableStringify(toComparableCommand(command));
}
async function wipeScope(rest, route, scopeLabel, extraLog = {}) {
  const existing = await rest.get(route);
  if (existing.length === 0) {
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

async function syncScopeDifferential(rest, routes, scopeLabel, commands, extraLog = {}) {
  const existing = await rest.get(routes.list);
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

  const existingByName = new Map(
    existing.map((command) => [command.name, { command, signature: computeSignatureFromCommand(command) }])
  );
  const created = [];
  const updated = [];
  const deleted = [];
  const unchanged = [];

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
        logger.debug(
          {
            scope: scopeLabel,
            name: command.name,
            before: toComparableCommand(current.command),
            after: toComparableCommand(command),
            ...extraLog
          },
          'Slash command detected difference'
        );
      }
      updated.push(command);
    }

    existingByName.delete(command.name);
  }

  for (const entry of existingByName.values()) {
    deleted.push(entry.command);
  }

  if (created.length === 0 && updated.length === 0 && deleted.length === 0) {
    logger.info(
      {
        scope: scopeLabel,
        unchanged: formatCommandList(unchanged),
        ...extraLog
      },
      `${scopeLabel}のコマンドは変更が無いため更新をスキップしました`
    );
    return;
  }

  const afterDeploy = await rest.put(routes.list, { body: commands });

  logger.info(
    {
      scope: scopeLabel,
      created: formatCommandList(created),
      updated: formatCommandList(updated),
      deleted: formatCommandList(deleted),
      unchanged: formatCommandList(unchanged),
      totalAfter: formatCommandList(afterDeploy),
      ...extraLog
    },
    `${scopeLabel}のコマンド差分同期が完了しました`
  );
}

async function main() {
  const commands = await collectCommands();
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    const deployGlobalEnv = process.env.DEPLOY_GLOBAL ?? 'true';
    const shouldDeployGlobal = deployGlobalEnv.toLowerCase() === 'true';
    const deployGuildEnv = process.env.DEPLOY_GUILD ?? 'false';
    const shouldDeployGuild = Boolean(guildId) && deployGuildEnv.toLowerCase() === 'true';
    const wipeAllEnv = process.env.WIPE_ALL_COMMANDS ?? 'false';
    const shouldWipeAll = wipeAllEnv.toLowerCase() === 'true';

    const globalRoutes = {
      list: Routes.applicationCommands(clientId)
    };

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
      const guildRoutes = {
        list: Routes.applicationGuildCommands(clientId, guildId)
      };

      if (shouldWipeAll) {
        await wipeScope(rest, guildRoutes.list, 'ギルド', { guildId });
      } else {
        await syncScopeDifferential(rest, guildRoutes, 'ギルド', commands, { guildId });
      }
    } else if (guildId) {
      if (shouldWipeAll) {
        await wipeScope(rest, Routes.applicationGuildCommands(clientId, guildId), 'ギルド', { guildId });
      }
      logger.info(
        {
          guildId,
          deployGuildEnv
        },
        '環境設定によりギルドコマンドの同期をスキップしました'
      );
    } else {
      logger.info('DISCORD_GUILD_ID が設定されていないため、ギルドコマンドの同期はスキップしました');
    }
  } catch (error) {
    logger.error({ err: error }, 'スラッシュコマンドのデプロイに失敗しました');
  }
}

main();
