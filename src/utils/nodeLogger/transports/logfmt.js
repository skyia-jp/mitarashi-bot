import { createWriteStream } from 'node:fs';
import { stdout, stderr } from 'node:process';
import { abstractTransport } from 'pino-abstract-transport';

const resolveDestinationStream = (destination) => {
  if (destination === 1 || destination === undefined) {
    return stdout;
  }

  if (destination === 2) {
    return stderr;
  }

  if (typeof destination === 'number') {
    throw new Error(`Unsupported numeric destination: ${destination}`);
  }

  return createWriteStream(destination, { flags: 'a', encoding: 'utf8' });
};

const flattenObject = (data, prefix = '', acc = {}) => {
  if (data === null || data === undefined) {
    acc[prefix] = data;
    return acc;
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    acc[prefix] = data;
    return acc;
  }

  for (const [key, value] of Object.entries(data)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenObject(value, nextPrefix, acc);
  }

  return acc;
};

const stringifyValue = (value) => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    const escaped = value.replace(/"/g, '\\"');
    return /\s/.test(escaped) ? `"${escaped}"` : escaped;
  }

  return String(value);
};

const toLogFmt = (obj) => {
  const flattened = flattenObject(obj);

  return Object.entries(flattened)
    .filter(([key, value]) => key && value !== undefined)
    .map(([key, value]) => `${key}=${stringifyValue(value)}`)
    .join(' ');
};

export default async function logfmtTransport(options = {}) {
  const {
    destination,
    serializer
  } = options;

  const stream = resolveDestinationStream(destination);
  const toLine = serializer ?? toLogFmt;

  return abstractTransport((source) => {
    source.on('data', (obj) => {
      try {
        const line = toLine(obj);
        if (line) {
          stream.write(`${line}\n`);
        }
      } catch (error) {
        stream.write(`logfmt_error=${JSON.stringify(error.message)}\n`);
      }
    });
  });
}
