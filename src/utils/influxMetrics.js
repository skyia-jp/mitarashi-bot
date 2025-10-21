import { InfluxDB, Point } from '@influxdata/influxdb-client';

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb.influxdb.svc.cluster.local:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'admin-token';
const INFLUX_ORG = process.env.INFLUX_ORG || 'my-org';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'discord-metrics';

const SEND_INTERVAL_MS = Number(process.env.METRICS_SEND_INTERVAL_MS || 10000);
const FLUSH_INTERVAL_MS = Number(process.env.INFLUX_FLUSH_INTERVAL_MS || 10000);
const FLUSH_RETRY_COUNT = Number(process.env.INFLUX_FLUSH_RETRY_COUNT || 3);
const FLUSH_RETRY_BASE_MS = Number(process.env.INFLUX_FLUSH_RETRY_BASE_MS || 500);
const METRICS_DETAILED = (process.env.METRICS_DETAILED || 'true') === 'true';

let writeApi = null;
let sendIntervalId = null;
let flushIntervalId = null;
let isShuttingDown = false;

function initInflux() {
  if (writeApi) return writeApi;
  const influx = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
  writeApi = influx.getWriteApi(INFLUX_ORG, INFLUX_BUCKET);
  // attach helpful default tags: host, pod, namespace, bot name
  writeApi.useDefaultTags({
    host: process.env.HOSTNAME || 'bot-host',
    pod: process.env.POD_NAME || process.env.HOSTNAME || 'unknown',
    namespace: process.env.POD_NAMESPACE || 'unknown',
    bot: process.env.BOT_NAME || 'discord-bot',
  });
  return writeApi;
}

function buildPoint(status = true) {
  const point = new Point('bot_status')
    .tag('bot', process.env.BOT_NAME || 'discord-bot')
    .tag('pod', process.env.POD_NAME || process.env.HOSTNAME || 'unknown')
    .tag('namespace', process.env.POD_NAMESPACE || 'unknown')
    .booleanField('alive', Boolean(status));

  if (METRICS_DETAILED) {
    try {
      const mem = process.memoryUsage();
      point.intField('memory_rss', Number(mem.rss));
      point.intField('memory_heapTotal', Number(mem.heapTotal));
      point.intField('memory_heapUsed', Number(mem.heapUsed));
      point.intField('uptime_sec', Math.floor(process.uptime()));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error collecting detailed metrics', err);
    }
  }

  return point;
}

export function sendBotMetrics(status = true) {
  try {
    const api = initInflux();
    const point = buildPoint(status);
    api.writePoint(point);
    // NOTE: do NOT flush here; flushing is handled by periodic flush to batch writes
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('sendBotMetrics error', err);
  }
}

async function flushWithRetry(retries = FLUSH_RETRY_COUNT) {
  if (!writeApi) return;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await writeApi.flush();
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Influx flush attempt ${attempt} failed`, err);
      if (attempt < retries) {
        const backoff = FLUSH_RETRY_BASE_MS * attempt;
        // wait
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, backoff));
      } else {
        // final failure
        // eslint-disable-next-line no-console
        console.error('Influx flush failed after retries');
      }
    }
  }
}

export function startBotMetrics(intervalMs = SEND_INTERVAL_MS) {
  initInflux();
  // send immediately then schedule periodic sends
  sendBotMetrics(true);
  if (sendIntervalId) clearInterval(sendIntervalId);
  sendIntervalId = setInterval(() => sendBotMetrics(true), intervalMs);

  // schedule periodic flush to batch writes
  if (flushIntervalId) clearInterval(flushIntervalId);
  flushIntervalId = setInterval(() => {
    flushWithRetry().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Periodic flush error', err);
    });
  }, FLUSH_INTERVAL_MS);

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    if (!writeApi) return;
    try {
      // send a final alive=false metric
      const point = buildPoint(false);
      writeApi.writePoint(point);
      await flushWithRetry();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error flushing Influx on shutdown', err);
    }
  };

  process.on('exit', () => {
    // best effort final flush (can't await here)
    shutdown();
  });
  process.on('SIGINT', () => {
    clearInterval(sendIntervalId);
    clearInterval(flushIntervalId);
    shutdown().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    clearInterval(sendIntervalId);
    clearInterval(flushIntervalId);
    shutdown().then(() => process.exit(0));
  });
}

export function stopBotMetrics() {
  if (sendIntervalId) {
    clearInterval(sendIntervalId);
    sendIntervalId = null;
  }
  if (flushIntervalId) {
    clearInterval(flushIntervalId);
    flushIntervalId = null;
  }
}
