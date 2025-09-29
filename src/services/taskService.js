import {
  createTask,
  deleteTask,
  listTasks,
  updateTask
} from '../database/repositories/taskRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

export async function createGuildTask(interaction, { description, dueDate, assigneeUser }) {
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

export function listGuildTasks(guildId, status = null, limit = 25) {
  return listTasks(guildId, status, limit);
}

export async function assignGuildTask(interaction, taskId, assigneeUser) {
  const assignee = await getOrCreateUser(assigneeUser);
  return updateTask(taskId, interaction.guildId, {
    assigneeId: assignee.id
  });
}

export function completeGuildTask(guildId, taskId) {
  return updateTask(taskId, guildId, { status: 'done' });
}

export function reopenGuildTask(guildId, taskId) {
  return updateTask(taskId, guildId, { status: 'open' });
}

export function deleteGuildTask(guildId, taskId) {
  return deleteTask(taskId, guildId);
}

export function updateTaskStatus(guildId, taskId, status) {
  return updateTask(taskId, guildId, { status });
}
