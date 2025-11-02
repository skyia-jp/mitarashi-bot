import { createModuleLogger } from '../../utils/logger.js';
import prisma from '../../database/client.js';
import { bootstrapScheduledJobs, ensureActivitySummaryJob } from '../../services/jobService.js';
import type { Client } from 'discord.js';

const readyLogger = createModuleLogger('event:ready');

export default {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    readyLogger.info(
      {
        event: 'bot.ready.received',
        guilds: client.guilds.cache.size,
        user_tag: client.user?.tag
      },
      'Ready event received'
    );

    try {
      await Promise.all(
        client.guilds.cache.map(async (guild) => {
          await prisma.guild.upsert({
            where: { id: guild.id },
            update: { name: guild.name },
            create: { id: guild.id, name: guild.name }
          });

          await ensureActivitySummaryJob(client, guild.id);
        })
      );

      await bootstrapScheduledJobs(client);
    } catch (err) {
      // 開発環境などで DB が起動していない場合でも Bot を落とさない。
      // エラーは記録して起動処理を続行する。
      readyLogger.warn(
        {
          event: 'bot.ready.bootstrap.error',
          err: err instanceof Error ? err.message : String(err)
        },
        'Ready bootstrap encountered an error (DB may be unavailable). Continuing without scheduled jobs.'
      );
    }

    readyLogger.info(
      {
        event: 'bot.ready.bootstrap.completed',
        scheduled_jobs: true
      },
      'Ready bootstrap tasks completed'
    );
  }
};
