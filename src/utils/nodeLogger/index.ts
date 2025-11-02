import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const logFmtTarget = resolve(moduleDir, './transports/logfmt.ts');

const isDevelopment = () => (process.env.NODE_ENV || 'development') === 'development';

const normalizeLevel = (level?: string) => {
  if (!level) return isDevelopment() ? 'trace' : 'info';
  return level;
};

const buildTransportTarget = (target: string, options: any = {}, level?: string) => {
  const transport: any = { target, options };
  if (level) transport.level = level;
  return transport;
};

export const Transporter = {
  FileTransporter(filePath: string, options: any = {}, level?: string) {
    if (!filePath) throw new Error('FileTransporter requires a file path.');
    return buildTransportTarget('pino/file', { destination: filePath, mkdir: true, ...options }, level);
  },
  ConsoleTransporter(options: any = {}, level?: string) {
    return buildTransportTarget('pino/file', { destination: 1, ...options }, level);
  },
  PinoPrettyTransporter(options: any = {}, level?: string) {
    return buildTransportTarget('pino-pretty', options, level);
  },
  LokiTransporter(host: string, options: any = {}, level?: string) {
    if (!host) throw new Error('LokiTransporter requires a host URL.');
    return buildTransportTarget('pino-loki', { host, ...options }, level);
  },
  LogFmtTransporter(options: any = {}, level?: string) {
    return buildTransportTarget(logFmtTarget, options, level);
  },
  DiscordTransporter(webhookUrl: any, options: any = {}, level?: string) {
    const trimmed = typeof webhookUrl === 'string' ? webhookUrl.trim() : webhookUrl;
    if (!trimmed) return null;
    return buildTransportTarget('pino-discord-webhook', { webhookUrl: trimmed, webhookURL: trimmed, ...options }, level);
  }
};

const defaultTimestamp = () => `,\"time\":\"${new Date().toISOString()}\"`;

const defaultErrorSerializer = (error: any) => {
  if (!error) return undefined;
  const plainObject: any = { type: error.name, message: error.message, stack: error.stack, code: error.code, details: error.details };
  for (const key of Object.keys(error)) if (!(key in plainObject)) plainObject[key] = error[key];
  return plainObject;
};

const mergeFormatters = (formatters: any = {}) => {
  const { level, ...rest } = formatters;
  const levelFormatter = level ? level : (label: any) => ({ level: label });
  return { ...rest, level: levelFormatter };
};

export const Logger = (name: string, transportTargets: any[] = [], level?: string, options: any = {}) => {
  if (!name) throw new Error('Logger name is required.');
  const resolvedLevel = normalizeLevel(level);
  const { base: baseOptions, formatters, timestamp, genReqId, serializers, ...restOptions } = options;
  const finalBase = { service: name, ...baseOptions };
  const finalOptions: any = { level: resolvedLevel, name, timestamp: timestamp ?? defaultTimestamp, formatters: mergeFormatters(formatters), genReqId: genReqId ?? (() => randomUUID()), serializers: { err: defaultErrorSerializer, error: defaultErrorSerializer, ...serializers }, ...restOptions, base: finalBase };
  const transport = transportTargets.length ? (pino as any).transport({ targets: transportTargets }) : undefined;
  return (pino as any)(finalOptions, transport);
};

export default { Logger, Transporter };
