import prisma from '../client.js';

export function upsertScheduledJob(guildId, type, schedule, data = null) {
  return prisma.scheduledJob.upsert({
    where: {
      guildId_type: {
        guildId,
        type
      }
    },
    update: {
      schedule,
      data
    },
    create: {
      guildId,
      type,
      schedule,
      data
    }
  });
}

export function listActiveJobs(type = null) {
  return prisma.scheduledJob.findMany({
    where: {
      isActive: true,
      ...(type ? { type } : {})
    }
  });
}

export function setJobActive(guildId, type, isActive) {
  return prisma.scheduledJob.updateMany({
    where: {
      guildId,
      type
    },
    data: {
      isActive
    }
  });
}

export function updateJobLastRun(id) {
  return prisma.scheduledJob.update({
    where: { id },
    data: { lastRun: new Date() }
  });
}

export function getJobByGuildAndType(guildId, type) {
  return prisma.scheduledJob.findUnique({
    where: {
      guildId_type: {
        guildId,
        type
      }
    }
  });
}
