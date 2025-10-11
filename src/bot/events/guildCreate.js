import prisma from '../../database/client.js';
import { createModuleLogger } from '../../utils/logger.js';
import { ensureActivitySummaryJob, setActivitySummaryActive } from '../../services/jobService.js';
import { isGuildBlacklisted } from '../../config/gban.js';

const guildLogger = createModuleLogger('event:guildCreate');

export default {
  name: 'guildCreate',
  async execute(client, guild) {
    if (isGuildBlacklisted(guild.id)) {
      await guild.leave().catch(() => null);
      return;
    }

    await prisma.guild.upsert({
      where: { id: guild.id },
      update: { name: guild.name },
      create: { id: guild.id, name: guild.name }
    });

    await ensureActivitySummaryJob(client, guild.id);
    await setActivitySummaryActive(client, guild.id, true);

    guildLogger.info(
      {
        event: 'guild.joined',
        guild_id: guild.id,
        guild_name: guild.name,
        member_count: guild.memberCount
      },
      'Joined new guild'
    );
  }
};
