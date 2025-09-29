import prisma from '../../database/client.js';
import logger from '../../utils/logger.js';
import { ensureActivitySummaryJob, setActivitySummaryActive } from '../../services/jobService.js';

export default {
  name: 'guildCreate',
  async execute(client, guild) {
    await prisma.guild.upsert({
      where: { id: guild.id },
      update: { name: guild.name },
      create: { id: guild.id, name: guild.name }
    });
  await ensureActivitySummaryJob(client, guild.id);
  await setActivitySummaryActive(client, guild.id, true);
    logger.info({ guildId: guild.id }, 'Joined new guild');
  }
};
