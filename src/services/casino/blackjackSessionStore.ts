import { randomUUID } from 'node:crypto';

const SESSION_TTL_MS = 10 * 60 * 1000;

type BlackjackSession = {
  id: string;
  createdAt: number;
  expiresAt: number;
  timeout: ReturnType<typeof setTimeout> | null;
  messageId: string | null;
  guildId?: string | null;
  userId?: string | null;
  [key: string]: any;
};

const sessions = new Map<string, BlackjackSession>();
const userIndex = new Map<string, string>();

function buildUserKey(guildId: string | null | undefined, userId: string) {
  return `${guildId ?? 'dm'}:${userId}`;
}

function scheduleExpiry(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.timeout) {
    clearTimeout(session.timeout);
  }

  const delay = Math.max(session.expiresAt - Date.now(), 1000);
  session.timeout = setTimeout(() => {
    endBlackjackSession(sessionId);
  }, delay);

  if (typeof (session.timeout as any).unref === 'function') {
    (session.timeout as any).unref();
  }
}

export function createBlackjackSession(payload: Partial<BlackjackSession> & { guildId?: string | null; userId?: string | null }) {
  const id = randomUUID();
  const now = Date.now();
  const session: BlackjackSession = {
    id,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    timeout: null,
    messageId: null,
    ...payload
  } as BlackjackSession;

  sessions.set(id, session);
  const userKey = buildUserKey(session.guildId, session.userId ?? '');
  userIndex.set(userKey, id);
  scheduleExpiry(id);
  return session;
}

export function attachMessageToSession(sessionId: string, messageId: string) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.messageId = messageId;
  return session;
}

export function getBlackjackSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    endBlackjackSession(sessionId);
    return null;
  }
  return session;
}

export function getActiveBlackjackSessionForUser(guildId: string | null, userId: string) {
  const userKey = buildUserKey(guildId, userId);
  const sessionId = userIndex.get(userKey);
  if (!sessionId) return null;
  return getBlackjackSession(sessionId);
}

export function updateBlackjackSession(sessionId: string, updater: (s: BlackjackSession) => BlackjackSession | void) {
  const session = getBlackjackSession(sessionId);
  if (!session) return null;
  const next = (updater(session) as BlackjackSession) ?? session;
  next.expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(sessionId, next);
  scheduleExpiry(sessionId);
  return next;
}

export function endBlackjackSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.timeout) {
    clearTimeout(session.timeout);
  }
  sessions.delete(sessionId);
  const userKey = buildUserKey(session.guildId, session.userId ?? '');
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
