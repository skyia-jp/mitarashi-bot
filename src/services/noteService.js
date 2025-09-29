import { createNote, deleteNote, listNotes } from '../database/repositories/noteRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

export async function addNote(interaction, content) {
  const author = await getOrCreateUser(interaction.user);
  return createNote({
    guildId: interaction.guildId,
    authorId: author.id,
    content
  });
}

export function getNotes(guildId, authorId = null, limit = 20) {
  return listNotes(guildId, authorId, limit);
}

export function removeNote(guildId, noteId) {
  return deleteNote(noteId, guildId);
}
