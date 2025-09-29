import prisma from '../client.js';

export function addFilterTerm(guildId, term, severity, createdById) {
  return prisma.filterTerm.create({
    data: {
      guildId,
      term,
      severity,
      createdById
    }
  });
}

export function removeFilterTerm(guildId, term) {
  return prisma.filterTerm.delete({
    where: {
      guildId_term: {
        guildId,
        term
      }
    }
  });
}

export function listFilterTerms(guildId) {
  return prisma.filterTerm.findMany({
    where: { guildId },
    orderBy: { severity: 'desc' }
  });
}
