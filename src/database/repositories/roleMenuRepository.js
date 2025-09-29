import prisma from '../client.js';

export function createRoleMenu(data) {
  const { options, ...menuData } = data;
  return prisma.roleMenu.create({
    data: {
      ...menuData,
      options: {
        create: options
      }
    },
    include: { options: true }
  });
}

export function updateRoleMenu(id, data) {
  return prisma.roleMenu.update({
    where: { id },
    data,
    include: { options: true }
  });
}

export function deleteRoleMenu(id) {
  return prisma.roleMenu.delete({ where: { id } });
}

export function getRoleMenuById(id) {
  return prisma.roleMenu.findUnique({
    where: { id },
    include: { options: true }
  });
}

export function getRoleMenuByMessage(guildId, messageId) {
  return prisma.roleMenu.findFirst({
    where: { guildId, messageId },
    include: { options: true }
  });
}

export function listRoleMenus(guildId) {
  return prisma.roleMenu.findMany({
    where: { guildId },
    include: { options: true }
  });
}
