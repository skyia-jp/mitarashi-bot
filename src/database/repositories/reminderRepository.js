import prisma from '../client.js';

export function createReminder(data) {
  return prisma.reminder.create({ data });
}

export function deleteReminder(id) {
  return prisma.reminder.delete({ where: { id } });
}

export function getReminderById(id) {
  return prisma.reminder.findUnique({ where: { id } });
}

export function listRemindersByUser(guildId, userId) {
  return prisma.reminder.findMany({
    where: { guildId, user: { discordId: userId } },
    orderBy: { createdAt: 'desc' }
  });
}

export function listPendingReminders() {
  return prisma.reminder.findMany();
}

export function updateReminder(id, data) {
  return prisma.reminder.update({ where: { id }, data });
}
