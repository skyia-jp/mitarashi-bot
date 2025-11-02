import { createNote, deleteNote, listNotes } from '../database/repositories/noteRepository.ts';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

export async function addNote(interaction: any, content: string) {
  const author = await getOrCreateUser(interaction.user);
  return createNote({
    guildId: interaction.guildId,
    authorId: author.id,
    content
  });
}

export function getNotes(guildId: string, authorId: number | null = null, limit = 20) {
  return listNotes(guildId, authorId, limit);
}

export function removeNote(guildId: string, noteId: number) {
  return deleteNote(noteId, guildId);
}
