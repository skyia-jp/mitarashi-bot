import prisma from '../client.js';

export function createTask(data) {
  return prisma.task.create({ data });
}

export function listTasks(guildId, status = null, limit = 25) {
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

export function updateTask(id, guildId, data) {
  return prisma.task.updateMany({
    where: {
      id,
      guildId
    },
    data
  });
}

export function deleteTask(id, guildId) {
  return prisma.task.deleteMany({
    where: {
      id,
      guildId
    }
  });
}
