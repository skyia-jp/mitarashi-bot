import { createModuleLogger } from '../../utils/logger.js';
import prisma from '../../database/client.js';
import { bootstrapScheduledJobs, ensureActivitySummaryJob } from '../../services/jobService.js';

const readyLogger = createModuleLogger('event:ready');

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    readyLogger.info(
      {
        event: 'bot.ready.received',
        guilds: client.guilds.cache.size,
        user_tag: client.user?.tag
      },
      'Ready event received'
    );

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

    readyLogger.info(
      {
        event: 'bot.ready.bootstrap.completed',
        scheduled_jobs: true
      },
      'Ready bootstrap tasks completed'
    );
  }
};
