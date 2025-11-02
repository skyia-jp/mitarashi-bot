import prisma from '../client.js';

export function createNote(data: any): Promise<any> {
  return prisma.note.create({ data });
}

export function listNotes(guildId: any, authorId: any = null, limit: number = 20): Promise<any> {
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

export function deleteNote(id: any, guildId: any): Promise<any> {
  return prisma.note.deleteMany({
    where: {
      id,
      guildId
    }
  });
}
