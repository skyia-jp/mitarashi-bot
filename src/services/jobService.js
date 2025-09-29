import cron from 'node-cron';
import {
  getJobByGuildAndType,
  listActiveJobs,
  setJobActive,
  updateJobLastRun,
  upsertScheduledJob
} from '../database/repositories/scheduledJobRepository.js';
import { getActivityLeaderboard } from './activityService.js';
import { getLogChannel } from './moderationService.js';

const scheduledTasks = new Map();

function getTimezone(job) {
  const tz = job.data?.timezone ?? job.data?.tz;
  return tz || 'Asia/Tokyo';
}

async function runActivitySummary(client, job) {
  const guild = await client.guilds.fetch(job.guildId).catch(() => null);
  if (!guild) return;

  const channelId = job.data?.channelId ?? job.data?.logChannelId;
  const channel = channelId
    ? await guild.channels.fetch(channelId).catch(() => null)
    : await getLogChannel(guild);

  if (!channel?.isTextBased()) return;

  const leaderboard = await getActivityLeaderboard(guild.id, job.data?.days ?? 7, job.data?.limit ?? 5);
  if (!leaderboard.length) return;

  const lines = leaderboard.map((entry, index) => {
    const name = entry.user?.username ?? entry.user?.discordId ?? 'Unknown';
    return `${index + 1}. **${name}** - メッセージ ${entry.messageCount}件 / VC ${entry.voiceMinutes}分`;
  });

  await channel.send({
    embeds: [
      {
        title: '📈 アクティビティサマリー',
        description: lines.join('\n'),
        color: 0xff8c00,
        timestamp: new Date().toISOString()
      }
    ]
  });
}

function scheduleJob(client, job) {
  const task = cron.schedule(
    job.schedule,
    async () => {
      if (job.type === 'activity-summary') {
        await runActivitySummary(client, job);
      }
      await updateJobLastRun(job.id).catch(() => null);
    },
    {
      timezone: getTimezone(job)
    }
  );

  scheduledTasks.set(job.id, task);
}

function stopJob(jobId) {
  const task = scheduledTasks.get(jobId);
  if (task) {
    task.stop();
    scheduledTasks.delete(jobId);
  }
}

export async function bootstrapScheduledJobs(client) {
  const jobs = await listActiveJobs();
  jobs.forEach((job) => {
    scheduleJob(client, { ...job, data: job.data ?? {} });
  });
}

export async function configureActivitySummary(client, guildId, { schedule, channelId, days = 7, limit = 5 }) {
  const data = {
    channelId,
    days,
    limit
  };

  const job = await upsertScheduledJob(guildId, 'activity-summary', schedule, data);
  stopJob(job.id);
  if (job.isActive !== false) {
    scheduleJob(client, { ...job, data });
  }
  return job;
}

export async function setActivitySummaryActive(client, guildId, isActive) {
  const result = await setJobActive(guildId, 'activity-summary', isActive);
  const job = await getJobByGuildAndType(guildId, 'activity-summary');
  if (!job) return result;

  if (isActive) {
    stopJob(job.id);
    scheduleJob(client, { ...job, data: job.data ?? {} });
  } else {
    stopJob(job.id);
  }

  return result;
}

export async function ensureActivitySummaryJob(client, guildId) {
  let job = await getJobByGuildAndType(guildId, 'activity-summary');
  if (!job) {
    job = await upsertScheduledJob(guildId, 'activity-summary', '0 0 * * *', {
      days: 7,
      limit: 5
    });
  }

  return job;
}
