import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const logFmtTarget = resolve(moduleDir, './transports/logfmt.js');

const isDevelopment = () => (process.env.NODE_ENV || 'development') === 'development';

const normalizeLevel = (level) => {
  if (!level) return isDevelopment() ? 'trace' : 'info';
  return level;
};

const buildTransportTarget = (target, options = {}, level) => {
  const transport = { target, options };

  if (level) {
    transport.level = level;
  }

  return transport;
};

export const Transporter = {
  FileTransporter(filePath, options = {}, level) {
    if (!filePath) {
      throw new Error('FileTransporter requires a file path.');
    }

    return buildTransportTarget(
      'pino/file',
      {
        destination: filePath,
        mkdir: true,
        ...options
      },
      level
    );
  },

  ConsoleTransporter(options = {}, level) {
    return buildTransportTarget(
      'pino/file',
      {
        destination: 1,
        ...options
      },
      level
    );
  },

  PinoPrettyTransporter(options = {}, level) {
    return buildTransportTarget('pino-pretty', options, level);
  },

  LokiTransporter(host, options = {}, level) {
    if (!host) {
      throw new Error('LokiTransporter requires a host URL.');
    }

    return buildTransportTarget(
      'pino-loki',
      {
        host,
        ...options
      },
      level
    );
  },

  LogFmtTransporter(options = {}, level) {
    return buildTransportTarget(logFmtTarget, options, level);
  },

  DiscordTransporter(webhookUrl, options = {}, level) {
    const trimmed = typeof webhookUrl === 'string' ? webhookUrl.trim() : webhookUrl;

    if (!trimmed) {
      return null;
    }

    return buildTransportTarget(
      'pino-discord-webhook',
      {
        webhookUrl: trimmed,
        webhookURL: trimmed,
        ...options
      },
      level
    );
  }
};

const defaultTimestamp = () => `,"time":"${new Date().toISOString()}"`;

const defaultErrorSerializer = (error) => {
  if (!error) return undefined;

  const plainObject = {
    type: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    details: error.details
  };

  for (const key of Object.keys(error)) {
    if (!(key in plainObject)) {
      plainObject[key] = error[key];
    }
  }

  return plainObject;
};

const mergeFormatters = (formatters = {}) => {
  const { level, ...rest } = formatters;

  const levelFormatter = level
    ? level
    : (label) => ({ level: label });

  return {
    ...rest,
    level: levelFormatter
  };
};

/**
 * Create a configured pino logger instance.
 *
 * @param {string} name - The logical name of the logger (service or application name).
 * @param {readonly object[]} transportTargets - Array of transport target definitions.
 * @param {string} [level] - Minimum log level (defaults to trace in development, info otherwise).
 * @param {import('pino').LoggerOptions} [options] - Additional pino LoggerOptions overrides.
 * @returns {import('pino').Logger}
 */
export const Logger = (name, transportTargets = [], level, options = {}) => {
  if (!name) {
    throw new Error('Logger name is required.');
  }

  const resolvedLevel = normalizeLevel(level);
  const {
    base: baseOptions,
    formatters,
    timestamp,
    genReqId,
    serializers,
    ...restOptions
  } = options;

  const finalBase = {
    service: name,
    ...baseOptions
  };

  const finalOptions = {
    level: resolvedLevel,
    name,
    timestamp: timestamp ?? defaultTimestamp,
    formatters: mergeFormatters(formatters),
    genReqId: genReqId ?? (() => randomUUID()),
    serializers: {
      err: defaultErrorSerializer,
      error: defaultErrorSerializer,
      ...serializers
    },
    ...restOptions,
    base: finalBase
  };

  const transport = transportTargets.length
    ? pino.transport({ targets: transportTargets })
    : undefined;

  return pino(finalOptions, transport);
};

export default {
  Logger,
  Transporter
};
