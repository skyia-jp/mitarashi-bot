import {
  createTask,
  deleteTask,
  listTasks,
  updateTask
} from '../database/repositories/taskRepository.ts';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

export async function createGuildTask(interaction: any, { description, dueDate, assigneeUser }: any) {
  const creator = await getOrCreateUser(interaction.user);
  const assignee = assigneeUser ? await getOrCreateUser(assigneeUser) : null;

  return createTask({
    guildId: interaction.guildId,
    creatorId: creator.id,
    assigneeId: assignee?.id ?? null,
    description,
    dueDate,
    status: 'open'
  });
}

export function listGuildTasks(guildId: string, status: string | null = null, limit = 25) {
  return listTasks(guildId, status, limit);
}

export async function assignGuildTask(interaction: any, taskId: number, assigneeUser: any) {
  const assignee = await getOrCreateUser(assigneeUser);
  return updateTask(taskId, interaction.guildId, {
    assigneeId: assignee.id
  });
}

export function completeGuildTask(guildId: string, taskId: number) {
  return updateTask(taskId, guildId, { status: 'done' });
}

export function reopenGuildTask(guildId: string, taskId: number) {
  return updateTask(taskId, guildId, { status: 'open' });
}

export function deleteGuildTask(guildId: string, taskId: number) {
  return deleteTask(taskId, guildId);
}

export function updateTaskStatus(guildId: string, taskId: number, status: string) {
  return updateTask(taskId, guildId, { status });
}
