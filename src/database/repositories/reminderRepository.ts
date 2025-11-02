import prisma from '../client.js';

export function createReminder(data: any): Promise<any> {
  return prisma.reminder.create({ data });
}

export function deleteReminder(id: any): Promise<any> {
  return prisma.reminder.delete({ where: { id } });
}

export function getReminderById(id: any): Promise<any> {
  return prisma.reminder.findUnique({ where: { id } });
}

export function listRemindersByUser(guildId: any, userId: any): Promise<any> {
  return prisma.reminder.findMany({
    where: { guildId, user: { discordId: userId } },
    orderBy: { createdAt: 'desc' }
  });
}

export function listPendingReminders(): Promise<any> {
  return prisma.reminder.findMany();
}

export function updateReminder(id: any, data: any): Promise<any> {
  return prisma.reminder.update({ where: { id }, data });
}
