import {
  createRoleMenu,
  deleteRoleMenu,
  getRoleMenuById,
  getRoleMenuByMessage,
  listRoleMenus,
  updateRoleMenu
} from '../database/repositories/roleMenuRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

export async function createMenu(interaction, payload) {
  const user = await getOrCreateUser(interaction.user);
  return createRoleMenu({
    ...payload,
    guildId: interaction.guildId,
    createdById: user.id
  });
}

export function attachMessageId(menuId, messageId) {
  return updateRoleMenu(menuId, { messageId });
}

export function removeMenu(menuId) {
  return deleteRoleMenu(menuId);
}

export function getMenuByMessage(guildId, messageId) {
  return getRoleMenuByMessage(guildId, messageId);
}

export function getMenu(menuId) {
  return getRoleMenuById(menuId);
}

export function listMenus(guildId) {
  return listRoleMenus(guildId);
}
