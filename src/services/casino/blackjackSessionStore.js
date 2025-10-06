import { randomUUID } from 'node:crypto';

const SESSION_TTL_MS = 10 * 60 * 1000;

const sessions = new Map();
const userIndex = new Map();

function buildUserKey(guildId, userId) {
  return `${guildId ?? 'dm'}:${userId}`;
}

function scheduleExpiry(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.timeout) {
    clearTimeout(session.timeout);
  }

  const delay = Math.max(session.expiresAt - Date.now(), 1000);
  session.timeout = setTimeout(() => {
    endBlackjackSession(sessionId);
  }, delay);

  if (typeof session.timeout.unref === 'function') {
    session.timeout.unref();
  }
}

export function createBlackjackSession(payload) {
  const id = randomUUID();
  const now = Date.now();
  const session = {
    id,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    timeout: null,
    messageId: null,
    ...payload
  };

  sessions.set(id, session);
  const userKey = buildUserKey(session.guildId, session.userId);
  userIndex.set(userKey, id);
  scheduleExpiry(id);
  return session;
}

export function attachMessageToSession(sessionId, messageId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.messageId = messageId;
  return session;
}

export function getBlackjackSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    endBlackjackSession(sessionId);
    return null;
  }
  return session;
}

export function getActiveBlackjackSessionForUser(guildId, userId) {
  const userKey = buildUserKey(guildId, userId);
  const sessionId = userIndex.get(userKey);
  if (!sessionId) return null;
  return getBlackjackSession(sessionId);
}

export function updateBlackjackSession(sessionId, updater) {
  const session = getBlackjackSession(sessionId);
  if (!session) return null;
  const next = updater(session) ?? session;
  next.expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(sessionId, next);
  scheduleExpiry(sessionId);
  return next;
}

export function endBlackjackSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.timeout) {
    clearTimeout(session.timeout);
  }
  sessions.delete(sessionId);
  const userKey = buildUserKey(session.guildId, session.userId);
  if (userIndex.get(userKey) === sessionId) {
    userIndex.delete(userKey);
  }
  return session;
}

export function clearExpiredBlackjackSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      endBlackjackSession(sessionId);
    }
  }
}

export function getBlackjackSessionCount() {
  return sessions.size;
}
