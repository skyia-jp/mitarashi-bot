import logger from '../../utils/logger.js';
import prisma from '../../database/client.js';
import { bootstrapScheduledJobs, ensureActivitySummaryJob } from '../../services/jobService.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info({ guilds: client.guilds.cache.size }, 'Ready event received');

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
  }
};
