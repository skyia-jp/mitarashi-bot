import { toHiragana } from 'wanakana';

import { addFilterTerm, listFilterTerms, removeFilterTerm } from '../database/repositories/filterRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

const cache = new Map();

function buildKey(guildId) {
  return `filter:${guildId}`;
}

function getCache(guildId) {
  return cache.get(buildKey(guildId));
}

function normalizeForComparison(text) {
  if (!text) return '';
  const canonical = text.normalize('NFKC');
  const hiragana = toHiragana(canonical, { passRomaji: true });
  return hiragana.toLowerCase();
}

export class FilterTermExistsError extends Error {
  constructor(term, existingTerm) {
    super(`Filter term already exists: ${existingTerm ?? term}`);
    this.name = 'FilterTermExistsError';
    this.term = term;
    this.existingTerm = existingTerm ?? term;
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
  const map = new Map(
    terms.map((term) => [normalizeForComparison(term.term), term])
  );
  cache.set(buildKey(guildId), map);
  return terms;
}

export async function ensureTerms(guildId) {
  const key = buildKey(guildId);
  if (!cache.has(key)) {
    await loadTerms(guildId);
  }
  return cache.get(key) ?? new Map();
}

export async function addTerm(interaction, term, severity = 1) {
  const trimmed = term?.trim();
  if (!trimmed) {
    throw new InvalidFilterTermError();
  }

  const normalized = normalizeForComparison(trimmed);
  const existing = await ensureTerms(interaction.guildId);
  const duplicate = existing.get(normalized);
  if (duplicate) {
    throw new FilterTermExistsError(trimmed, duplicate.term);
  }

  const user = await getOrCreateUser(interaction.user);

  try {
    await addFilterTerm(interaction.guildId, trimmed, severity, user.id);
  } catch (error) {
    if (error?.code === 'P2002') {
      const refreshed = await ensureTerms(interaction.guildId);
      const existingTerm = refreshed.get(normalized)?.term;
      throw new FilterTermExistsError(trimmed, existingTerm);
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
  const terms = getCache(guildId);
  if (!terms?.size || !content) return false;
  const normalized = normalizeForComparison(content);
  for (const candidate of terms.keys()) {
    if (normalized.includes(candidate)) {
      return true;
    }
  }
  return false;
}
