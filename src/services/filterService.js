import { addFilterTerm, listFilterTerms, removeFilterTerm } from '../database/repositories/filterRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

const cache = new Map();

function buildKey(guildId) {
  return `filter:${guildId}`;
}

export async function loadTerms(guildId) {
  const terms = await listFilterTerms(guildId);
  cache.set(buildKey(guildId), terms.map((term) => term.term.toLowerCase()));
  return terms;
}

export async function ensureTerms(guildId) {
  const key = buildKey(guildId);
  if (!cache.has(key)) {
    await loadTerms(guildId);
  }
  return cache.get(key) ?? [];
}

export async function addTerm(interaction, term, severity = 1) {
  const user = await getOrCreateUser(interaction.user);
  await addFilterTerm(interaction.guildId, term, severity, user.id);
  await loadTerms(interaction.guildId);
}

export async function deleteTerm(guildId, term) {
  await removeFilterTerm(guildId, term);
  await loadTerms(guildId);
}

export function containsFilteredTerm(guildId, content) {
  const terms = cache.get(buildKey(guildId));
  if (!terms?.length || !content) return false;
  const normalized = content.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}
