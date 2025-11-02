import prisma from '../client.js';

type PollOptionInput = { label: string; emoji?: string | null };

export function createPoll({ guildId, channelId, question, createdById, options }: {
  guildId: string;
  channelId: string;
  question: string;
  createdById: number | string;
  options: PollOptionInput[];
}): Promise<any> {
  return prisma.poll.create({
    data: {
      guildId,
      channelId,
      question,
      createdById: createdById as any,
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

export function assignPollMessageId(pollId: any, messageId: string): Promise<any> {
  return prisma.poll.update({
    where: { id: pollId },
    data: { messageId }
  });
}

export function getPollByMessageId(messageId: string): Promise<any> {
  return prisma.poll.findFirst({
    where: { messageId },
    include: {
      options: {
        orderBy: { position: 'asc' }
      }
    }
  });
}

export function getPollById(pollId: any): Promise<any> {
  return prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        orderBy: { position: 'asc' }
      }
    }
  });
}

export function closePoll(pollId: any): Promise<any> {
  return prisma.poll.update({
    where: { id: pollId },
    data: { status: 'closed' }
  });
}

export function recordVote(pollId: any, optionId: any, userId: any): Promise<any> {
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

export function getVoteStats(pollId: any): Promise<any> {
  return (prisma as any).pollVote.groupBy({
    by: ['optionId'],
    where: {
      pollId
    },
    _count: {
      optionId: true
    }
  });
}

export function listPollsByGuild(guildId: string, { take = 10, skip = 0 }: { take?: number; skip?: number } = {}): Promise<any> {
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
