import { toHiragana } from 'wanakana';

import { addFilterTerm, listFilterTerms, removeFilterTerm } from '../database/repositories/filterRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

const cache = new Map();

function buildKey(guildId) {
  return `filter:${guildId}`;
}

function normalizeForComparison(text) {
  if (!text) return '';
  const canonical = text.normalize('NFKC');
  const hiragana = toHiragana(canonical, { passRomaji: true });
  return hiragana.toLowerCase();
}

export class FilterTermExistsError extends Error {
  constructor(term) {
    super(`Filter term already exists: ${term}`);
    this.name = 'FilterTermExistsError';
    this.term = term;
  }
}

export class InvalidFilterTermError extends Error {
  constructor() {
    super('Filter term must not be empty.');
    this.name = 'InvalidFilterTermError';
  }
}

export async function loadTerms(guildId) {
  const terms = await listFilterTerms(guildId);
  cache.set(buildKey(guildId), terms.map((term) => normalizeForComparison(term.term)));
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
  const trimmed = term?.trim();
  if (!trimmed) {
    throw new InvalidFilterTermError();
  }

  const normalized = normalizeForComparison(trimmed);
  const existing = await ensureTerms(interaction.guildId);
  if (existing.includes(normalized)) {
    throw new FilterTermExistsError(trimmed);
  }

  const user = await getOrCreateUser(interaction.user);

  try {
    await addFilterTerm(interaction.guildId, trimmed, severity, user.id);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new FilterTermExistsError(trimmed);
    }
    throw error;
  }

  await loadTerms(interaction.guildId);
  return trimmed;
}

export async function deleteTerm(guildId, term) {
  await removeFilterTerm(guildId, term);
  await loadTerms(guildId);
}

export function containsFilteredTerm(guildId, content) {
  const terms = cache.get(buildKey(guildId));
  if (!terms?.length || !content) return false;
  const normalized = normalizeForComparison(content);
  return terms.some((term) => normalized.includes(term));
}
