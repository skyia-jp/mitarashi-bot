import cron, { validate as validateCronExpression } from 'node-cron';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { DEFAULT_TIMEZONE } from '../config/constants.js';
import { createModuleLogger } from '../utils/logger.js';
import prisma from '../database/client.js';
import { createReminder, deleteReminder, listPendingReminders } from '../database/repositories/reminderRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

const scheduledTasks = new Map();

const reminderLogger = createModuleLogger('service:reminder');

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault(DEFAULT_TIMEZONE);

function buildTaskKey(reminder) {
  return `reminder:${reminder.id}`;
}

async function runReminder(client, reminder) {
  try {
    const guild = await client.guilds.fetch(reminder.guildId);
    const channel = await guild.channels.fetch(reminder.channelId);
    if (!channel || !channel.isTextBased()) {
      reminderLogger.warn(
        {
          event: 'reminder.execute.channel_unavailable',
          reminder_id: reminder.id,
          guild_id: reminder.guildId,
          channel_id: reminder.channelId
        },
        'Channel not found or not text-based'
      );
      return;
    }

    const mention = `<@${reminder.user.discordId}>`;
    await channel.send({ content: `${mention} ⏰ リマインダー: ${reminder.message}` });

    // No-op: node-cron handles scheduling the next execution automatically.
  } catch (error) {
    reminderLogger.error(
      {
        err: error,
        event: 'reminder.execute.error',
        reminder_id: reminder.id,
        guild_id: reminder.guildId,
        channel_id: reminder.channelId
      },
      'Failed to execute reminder'
    );
  }
}

function scheduleReminder(client, reminder) {
  const key = buildTaskKey(reminder);
  if (scheduledTasks.has(key)) {
    scheduledTasks.get(key).stop();
  }

  const task = cron.schedule(
    reminder.cronExpression,
    async () => {
    const fresh = await prisma.reminder.findUnique({
      where: { id: reminder.id },
      include: { user: true }
    });

    if (!fresh) {
      task.stop();
      scheduledTasks.delete(key);
      return;
    }

    await runReminder(client, fresh);
    },
    {
      timezone: reminder.timezone || DEFAULT_TIMEZONE
    }
  );

  scheduledTasks.set(key, task);
}

export async function bootstrapReminders(client) {
  const reminders = await listPendingReminders();
  for (const reminder of reminders) {
    scheduleReminder(client, reminder);
  }
  reminderLogger.info(
    {
      event: 'reminder.bootstrap.scheduled',
      count: reminders.length
    },
    'Reminders scheduled'
  );
}

export async function registerReminder(client, discordUser, payload) {
  if (!validateCronExpression(payload.cronExpression)) {
    throw new Error('Invalid cron expression');
  }
  const user = await getOrCreateUser(discordUser);
  const reminder = await createReminder({
    ...payload,
    userId: user.id,
    timezone: payload.timezone || DEFAULT_TIMEZONE
  });
  scheduleReminder(client, reminder);
  return reminder;
}

export async function cancelReminder(reminderId) {
  const key = buildTaskKey({ id: reminderId });
  const reminder = await deleteReminder(reminderId);
  if (scheduledTasks.has(key)) {
    scheduledTasks.get(key).stop();
    scheduledTasks.delete(key);
  }
  return reminder;
}
