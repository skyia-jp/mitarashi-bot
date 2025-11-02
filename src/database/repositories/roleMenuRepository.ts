import prisma from '../client.js';
import type { RoleMenu, RoleMenuOption, Prisma } from '@prisma/client';

export async function createRoleMenu(data: Prisma.RoleMenuCreateInput | any) {
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

export async function updateRoleMenu(id: number, data: Prisma.RoleMenuUpdateInput | any) {
  return prisma.roleMenu.update({
    where: { id },
    data,
    include: { options: true }
  });
}

export async function deleteRoleMenu(id: number) {
  return prisma.roleMenu.delete({ where: { id } });
}

export async function getRoleMenuById(id: number): Promise<(RoleMenu & { options: RoleMenuOption[] }) | null> {
  return prisma.roleMenu.findUnique({
    where: { id },
    include: { options: true }
  });
}

export async function getRoleMenuByMessage(guildId: string, messageId: string): Promise<(RoleMenu & { options: RoleMenuOption[] }) | null> {
  return prisma.roleMenu.findFirst({
    where: { guildId, messageId },
    include: { options: true }
  });
}

export async function listRoleMenus(guildId: string): Promise<(RoleMenu & { options: RoleMenuOption[] })[]> {
  return prisma.roleMenu.findMany({
    where: { guildId },
    include: { options: true }
  });
}
