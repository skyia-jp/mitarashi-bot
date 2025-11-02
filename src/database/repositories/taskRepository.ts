import prisma from '../client.js';

export function createTask(data: any): Promise<any> {
  return prisma.task.create({ data });
}

export function listTasks(guildId: any, status: any = null, limit: number = 25): Promise<any> {
  return prisma.task.findMany({
    where: {
      guildId,
      ...(status ? { status } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      creator: true,
      assignee: true
    }
  });
}

export function updateTask(id: any, guildId: any, data: any): Promise<any> {
  return prisma.task.updateMany({
    where: {
      id,
      guildId
    },
    data
  });
}

export function deleteTask(id: any, guildId: any): Promise<any> {
  return prisma.task.deleteMany({
    where: {
      id,
      guildId
    }
  });
}
