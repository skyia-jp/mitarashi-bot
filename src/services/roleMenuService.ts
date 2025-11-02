import {
  createRoleMenu,
  deleteRoleMenu,
  getRoleMenuById,
  getRoleMenuByMessage,
  listRoleMenus,
  updateRoleMenu
} from '../database/repositories/roleMenuRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';
import type { RoleMenu, RoleMenuOption } from '@prisma/client';

export async function createMenu(interaction: any, payload: any): Promise<RoleMenu & { options: RoleMenuOption[] }> {
  const user = await getOrCreateUser(interaction.user);
  return createRoleMenu({
    ...payload,
    guildId: interaction.guildId,
    createdById: user.id
  });
}

export function attachMessageId(menuId: number, messageId: string) {
  return updateRoleMenu(menuId, { messageId });
}

export function removeMenu(menuId: number) {
  return deleteRoleMenu(menuId);
}

export function getMenuByMessage(guildId: string, messageId: string) {
  return getRoleMenuByMessage(guildId, messageId);
}

export function getMenu(menuId: number) {
  return getRoleMenuById(menuId);
}

export function listMenus(guildId: string) {
  return listRoleMenus(guildId);
}
