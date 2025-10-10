import {
  assignPollMessageId,
  closePoll,
  createPoll,
  getPollById,
  getPollByMessageId,
  getVoteStats,
  listPollsByGuild,
  recordVote
} from '../database/repositories/pollRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

export async function createGuildPoll(interaction, { question, options }) {
  const creator = await getOrCreateUser(interaction.user);
  const poll = await createPoll({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    question,
    createdById: creator.id,
    options
  });

  return poll;
}

export function buildPollComponents(poll) {
  return poll.options.map((option) => ({
    type: 2,
    style: 1,
    label: option.label,
    custom_id: `poll:${poll.id}:${option.id}`,
    emoji: option.emoji ?? undefined
  }));
}

export function buildPollEmbed(summary) {
  const { poll, optionStats, totalVotes } = summary;
  const fields = optionStats.map(({ option, count }) => {
    const percentage = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
    const barLength = Math.round((percentage / 100) * 10);
    const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
    return {
      name: `${option.emoji ? `${option.emoji} ` : ''}${option.label}`,
      value: `${bar} ${count}票 (${percentage}%)`,
      inline: false
    };
  });

  return {
    title: `🗳️ ${poll.question}`,
    description: `状態: ${poll.status === 'open' ? '受付中' : '終了'}`,
    color: poll.status === 'open' ? 0x5865f2 : 0x95a5a6,
    fields,
    footer: { text: `投票数: ${totalVotes}` },
    timestamp: new Date().toISOString()
  };
}

export async function attachPollMessageId(pollId, messageId) {
  await assignPollMessageId(pollId, messageId);
}

export async function registerPollVote(poll, user) {
  await recordVote(poll.id, user.optionId, user.userId);
}

export async function handlePollVote(interaction, pollId, optionId) {
  const poll = await getPollById(pollId);
  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.status !== 'open') {
    return {
      status: 'closed',
      poll
    };
  }

  const voter = await getOrCreateUser(interaction.user);
  await recordVote(poll.id, optionId, voter.id);

  return {
    status: 'recorded',
    poll
  };
}

export async function summarizePoll(pollId) {
  const poll = await getPollById(pollId);
  if (!poll) {
    throw new Error('Poll not found');
  }
  const stats = await getVoteStats(pollId);
  const counts = stats.reduce((acc, row) => {
    acc[row.optionId] = row._count.optionId;
    return acc;
  }, {});

  const total = stats.reduce((sum, row) => sum + row._count.optionId, 0);

  return {
    poll,
    totalVotes: total,
    optionStats: poll.options.map((option) => ({
      option,
      count: counts[option.id] ?? 0
    }))
  };
}

export async function closePollWithSummary(pollId) {
  await closePoll(pollId);
  return summarizePoll(pollId);
}

export { getPollByMessageId };

export async function listGuildPolls(guildId, { limit = 10, offset = 0 } = {}) {
  const take = Math.max(1, Math.min(limit, 50));
  const skip = Math.max(0, offset);
  return listPollsByGuild(guildId, { take, skip });
}
