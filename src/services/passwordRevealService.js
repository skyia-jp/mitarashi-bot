import crypto from 'node:crypto';
import prisma from '../database/client.js';

const DEFAULT_TTL_MS = Number.parseInt(process.env.PASSWORD_REVEAL_TTL_MS ?? '', 10) || 1000 * 60 * 60 * 24;

async function cleanupExpired() {
  const now = new Date();
  await prisma.passwordReveal.deleteMany({
    where: {
      expiresAt: { lte: now }
    }
  });
}

export async function registerPasswordReveal({
  guildId,
  channelId,
  createdById,
  password,
  title,
  description,
  buttonLabel,
  ttlMs
}) {
  const customId = `pwd_reveal:${crypto.randomUUID()}`;
  const effectiveTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + effectiveTtl);

  await cleanupExpired();

  const record = await prisma.passwordReveal.create({
    data: {
      customId,
      guildId,
      channelId,
      createdById,
      password,
      title,
      description,
      buttonLabel,
      expiresAt
    }
  });

  return { customId, expiresAt: record.expiresAt ?? expiresAt };
}

export async function getPasswordReveal(customId) {
  await cleanupExpired();

  const entry = await prisma.passwordReveal.findUnique({
    where: { customId }
  });

  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) {
    await prisma.passwordReveal.delete({ where: { customId } }).catch(() => {});
    return null;
  }

  return entry;
}

export async function deletePasswordReveal(customId) {
  await prisma.passwordReveal.delete({ where: { customId } }).catch(() => {});
}
