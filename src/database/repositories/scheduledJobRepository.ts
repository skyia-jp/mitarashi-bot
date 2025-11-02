import prisma from '../client.js';

export function upsertScheduledJob(guildId: any, type: any, schedule: any, data: any = null): Promise<any> {
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

export function listActiveJobs(type: any = null): Promise<any> {
  return prisma.scheduledJob.findMany({
    where: {
      isActive: true,
      ...(type ? { type } : {})
    }
  });
}

export function setJobActive(guildId: any, type: any, isActive: boolean): Promise<any> {
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

export function updateJobLastRun(id: any): Promise<any> {
  return prisma.scheduledJob.update({
    where: { id },
    data: { lastRun: new Date() }
  });
}

export function getJobByGuildAndType(guildId: any, type: any): Promise<any> {
  return prisma.scheduledJob.findUnique({
    where: {
      guildId_type: {
        guildId,
        type
      }
    }
  });
}
