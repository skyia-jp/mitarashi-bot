import { toHiragana, toKatakana, isHiragana, isKatakana } from 'wanakana';

import { addFilterTerm, listFilterTerms, removeFilterTerm } from '../database/repositories/filterRepository.js';
import { getOrCreateUser } from '../database/repositories/userRepository.js';

const cache = new Map();

function buildKey(guildId) {
  return `filter:${guildId}`;
}

function getCache(guildId) {
  return cache.get(buildKey(guildId));
}

function coerceToMap(key) {
  const cached = cache.get(key);
  if (cached instanceof Map) {
    return cached;
  }
  if (Array.isArray(cached)) {
    const fallback = new Map(cached.map((value) => [value, { term: value }]));
    cache.set(key, fallback);
    return fallback;
  }
  return undefined;
}

function normalizeForComparison(text) {
  if (!text) return '';
  const canonical = text.normalize('NFKC');
  const hiragana = toHiragana(canonical, { passRomaji: true });
  return hiragana.toLowerCase();
}

function generateKanaVariants(term) {
  const variants = new Set([term]);
  if (!term) {
    return variants;
  }

  const trimmed = term.trim();
  if (!trimmed) {
    return variants;
  }

  if (isHiragana(trimmed) || isKatakana(trimmed)) {
    const hiraganaVariant = toHiragana(trimmed);
    const katakanaVariant = toKatakana(trimmed);
    if (hiraganaVariant && hiraganaVariant !== trimmed) {
      variants.add(hiraganaVariant);
    }
    if (katakanaVariant && katakanaVariant !== trimmed) {
      variants.add(katakanaVariant);
    }
  }

  return variants;
}

export class FilterTermExistsError extends Error {
  constructor(term, existingTerm) {
    super(`Filter term already exists: ${existingTerm ?? term}`);
    this.name = 'FilterTermExistsError';
    this.term = term;
    this.existingTerm = existingTerm ?? term;
    this.code = 'FILTER_TERM_EXISTS';
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
  const initial = cache.get(key);
  let terms = coerceToMap(key);
  if (initial instanceof Map && terms) {
    return terms;
  }

  await loadTerms(guildId);
  terms = coerceToMap(key);
  if (terms) {
    return terms;
  }

  const empty = new Map();
  cache.set(key, empty);
  return empty;
}

export async function addTerm(interaction, term, severity = 1) {
  const trimmed = term?.trim();
  if (!trimmed) {
    throw new InvalidFilterTermError();
  }

  const variants = generateKanaVariants(trimmed);
  const normalized = normalizeForComparison(trimmed);
  const existing = await ensureTerms(interaction.guildId);
  for (const variant of variants) {
    const normalizedVariant = normalizeForComparison(variant);
    const duplicate = existing.get(normalizedVariant);
    if (duplicate) {
      throw new FilterTermExistsError(trimmed, duplicate.term);
    }
  }

  const user = await getOrCreateUser(interaction.user);

  try {
    await addFilterTerm(interaction.guildId, trimmed, severity, user.id);
    existing.set(normalized, { term: trimmed, severity, createdById: user.id });
  } catch (error) {
    if (error?.code === 'P2002') {
      const refreshed = await ensureTerms(interaction.guildId);
      const existingTerm = refreshed.get(normalized)?.term;
      throw new FilterTermExistsError(trimmed, existingTerm);
    }
    throw error;
  }

  for (const variant of variants) {
    if (variant === trimmed) continue;
    const variantNormalized = normalizeForComparison(variant);
    if (existing.has(variantNormalized)) continue;
    try {
      await addFilterTerm(interaction.guildId, variant, severity, user.id);
      existing.set(variantNormalized, { term: variant, severity, createdById: user.id });
    } catch (error) {
      if (error?.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  await loadTerms(interaction.guildId);
  return trimmed;
}

export async function deleteTerm(guildId, term) {
  await removeFilterTerm(guildId, term);
  await loadTerms(guildId);
}

export function containsFilteredTerm(guildId, content) {
  const key = buildKey(guildId);
  const terms = getCache(guildId);
  if (!terms || !content) return false;
  const normalized = normalizeForComparison(content);
  if (terms instanceof Map) {
    for (const candidate of terms.keys()) {
      if (normalized.includes(candidate)) {
        return true;
      }
    }
    return false;
  }
  if (Array.isArray(terms)) {
    return terms.some((candidate) => normalized.includes(candidate));
  }
  cache.delete(key);
  return false;
}
