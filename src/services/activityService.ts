import dayjs from 'dayjs';
import prisma from '../database/client.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('services:activityService');

const voiceSessionMap = new Map<string, number>();

// メモリキャッシュ: guildId:userId:date -> { messageCount, voiceMinutes }
const activityCache = new Map<string, { messageCount: number; voiceMinutes: number }>();
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5分ごとにフラッシュ

function getActivityDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getCacheKey(guildId: string, userId: string, date: Date): string {
  return `${guildId}::${userId}::${date.toISOString()}`;
}

export async function recordMessageActivity(guildId: string, userId: string) {
  const date = getActivityDate();
  const key = getCacheKey(guildId, userId, date);
  
  const cached = activityCache.get(key) ?? { messageCount: 0, voiceMinutes: 0 };
  cached.messageCount += 1;
  activityCache.set(key, cached);
  
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushActivityCache().catch((err) => {
      logger.error({ err }, 'Failed to flush activity cache');
    });
  }, FLUSH_INTERVAL_MS);
}

async function flushActivityCache() {
  if (activityCache.size === 0) return;
  
  const entries = Array.from(activityCache.entries());
  activityCache.clear();
  
  logger.info({ count: entries.length }, 'Flushing activity cache to database');
  
  const operations = entries.map(([key, data]) => {
    const parts = key.split('::');
    const guildId = parts[0];
    const discordUserId = parts[1];
    const dateStr = parts[2];
    const date = new Date(dateStr);
    
    return prisma.activityRecord.upsert({
      where: {
        guildId_discordUserId_date: { guildId, discordUserId, date }
      },
      update: {
        messageCount: { increment: data.messageCount },
        voiceMinutes: { increment: data.voiceMinutes },
        lastUpdated: new Date()
      },
      create: {
        guildId,
        discordUserId,
        date,
        messageCount: data.messageCount,
        voiceMinutes: data.voiceMinutes,
        lastUpdated: new Date()
      }
    }).catch((err: any) => {
      if (err?.code === 'P2002') {
        return prisma.activityRecord.update({
          where: { guildId_discordUserId_date: { guildId, discordUserId, date } },
          data: {
            messageCount: { increment: data.messageCount },
            voiceMinutes: { increment: data.voiceMinutes },
            lastUpdated: new Date()
          }
        });
      }
      throw err;
    });
  });
  
  await Promise.allSettled(operations);
}

export function startVoiceSession(guildId: string, userId: string) {
  voiceSessionMap.set(`${guildId}::${userId}`, Date.now());
}

export async function endVoiceSession(guildId: string, userId: string) {
  const key = `${guildId}::${userId}`;
  const startedAt = voiceSessionMap.get(key);
  if (!startedAt) return;
  voiceSessionMap.delete(key);
  
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const date = getActivityDate();
  const cacheKey = getCacheKey(guildId, userId, date);
  
  const cached = activityCache.get(cacheKey) ?? { messageCount: 0, voiceMinutes: 0 };
  cached.voiceMinutes += minutes;
  activityCache.set(cacheKey, cached);
  
  scheduleFlush();
}

export async function getActivityLeaderboard(guildId: string, days = 7, limit = 10) {
  // 最新データを反映するためフラッシュ
  await flushActivityCache();
  
  // UTC基準で日付範囲を計算
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  
  const records = await prisma.activityRecord.groupBy({
    by: ['discordUserId'],
    where: {
      guildId,
      date: {
        gte: since
      }
    },
    _sum: {
      messageCount: true,
      voiceMinutes: true
    },
    orderBy: {
      _sum: {
        messageCount: 'desc'
      }
    },
    take: limit
  });

  return records.map((record: any) => ({
    discordUserId: record.discordUserId,
    messageCount: record._sum.messageCount ?? 0,
    voiceMinutes: record._sum.voiceMinutes ?? 0
  }));
}

// Graceful shutdown時にキャッシュをフラッシュ
export async function shutdownActivityService() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushActivityCache();
  logger.info('Activity service shutdown complete');
}
