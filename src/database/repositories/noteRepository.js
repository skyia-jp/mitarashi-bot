import prisma from '../client.js';

export function createNote(data) {
  return prisma.note.create({ data });
}

export function listNotes(guildId, authorId = null, limit = 20) {
  return prisma.note.findMany({
    where: {
      guildId,
      ...(authorId ? { authorId } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      author: true
    }
  });
}

export function deleteNote(id, guildId) {
  return prisma.note.deleteMany({
    where: {
      id,
      guildId
    }
  });
}
