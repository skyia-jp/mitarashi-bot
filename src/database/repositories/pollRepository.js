import prisma from '../client.js';

export function createPoll({ guildId, channelId, question, createdById, options }) {
  return prisma.poll.create({
    data: {
      guildId,
      channelId,
      question,
      createdById,
      options: {
        create: options.map((option, index) => ({
          label: option.label,
          emoji: option.emoji ?? null,
          position: index
        }))
      }
    },
    include: {
      options: true
    }
  });
}

export function assignPollMessageId(pollId, messageId) {
  return prisma.poll.update({
    where: { id: pollId },
    data: { messageId }
  });
}

export function getPollByMessageId(messageId) {
  return prisma.poll.findFirst({
    where: { messageId },
    include: {
      options: {
        orderBy: { position: 'asc' }
      }
    }
  });
}

export function getPollById(pollId) {
  return prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        orderBy: { position: 'asc' }
      }
    }
  });
}

export function closePoll(pollId) {
  return prisma.poll.update({
    where: { id: pollId },
    data: { status: 'closed' }
  });
}

export function recordVote(pollId, optionId, userId) {
  return prisma.pollVote.upsert({
    where: {
      pollId_userId: {
        pollId,
        userId
      }
    },
    update: {
      optionId
    },
    create: {
      pollId,
      optionId,
      userId
    }
  });
}

export function getVoteStats(pollId) {
  return prisma.pollVote.groupBy({
    by: ['optionId'],
    where: {
      pollId
    },
    _count: {
      optionId: true
    }
  });
}

export function listPollsByGuild(guildId, { take = 10, skip = 0 } = {}) {
  return prisma.poll.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
    select: {
      id: true,
      question: true,
      status: true,
      channelId: true,
      messageId: true,
      createdAt: true,
      updatedAt: true
    }
  });
}
