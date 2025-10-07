import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importRecursively } from '../src/utils/fileLoader.js';
import logger from '../src/utils/logger.js';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

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
  return commands.map((command) => ({
    id: command.id,
    name: command.name,
    description: command.description,
    type: command.type
  }));
}

async function syncScope(rest, route, scopeLabel, commands, extraLog = {}) {
  const existing = await rest.get(route);
  logger.info(
    {
      scope: scopeLabel,
      count: existing.length,
      commands: formatCommandList(existing),
      ...extraLog
    },
    `${scopeLabel}の既存コマンド一覧`
  );

  if (existing.length > 0) {
    await rest.put(route, { body: [] });
    const afterDelete = await rest.get(route);
    logger.info(
      {
        scope: scopeLabel,
        count: afterDelete.length,
        commands: formatCommandList(afterDelete),
        ...extraLog
      },
      `${scopeLabel}のコマンドを全削除しました`
    );
  } else {
    logger.info({ scope: scopeLabel, ...extraLog }, `${scopeLabel}に削除対象のコマンドはありません`);
  }

  if (Array.isArray(commands)) {
    await rest.put(route, { body: commands });
    const afterDeploy = await rest.get(route);
    logger.info(
      {
        scope: scopeLabel,
        count: afterDeploy.length,
        commands: formatCommandList(afterDeploy),
        ...extraLog
      },
      `${scopeLabel}にコマンドを再デプロイしました`
    );
  } else {
    logger.info({ scope: scopeLabel, ...extraLog }, `${scopeLabel}の再デプロイはスキップしました`);
  }
}

async function main() {
  const commands = await collectCommands();
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    const deployGlobalEnv = process.env.DEPLOY_GLOBAL ?? 'true';
    const shouldDeployGlobal = deployGlobalEnv.toLowerCase() === 'true';
    const deployGuildEnv = process.env.DEPLOY_GUILD ?? 'false';
    const shouldDeployGuild = Boolean(guildId) && deployGuildEnv.toLowerCase() === 'true';

    if (shouldDeployGlobal) {
      await syncScope(rest, Routes.applicationCommands(clientId), 'グローバル', commands);
    } else {
      await syncScope(rest, Routes.applicationCommands(clientId), 'グローバル', null);
    }

    if (shouldDeployGuild) {
      await syncScope(rest, Routes.applicationGuildCommands(clientId, guildId), 'ギルド', commands, {
        guildId
      });
    } else if (guildId) {
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
