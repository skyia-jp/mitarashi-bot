// Simple Node.js script (CommonJS) to write a point to Influx using token or basic auth fallback
const http = require('http');
const https = require('https');
const url = require('url');

const INFLUX_URL = process.env.INFLUX_URL || 'https://influxdb.skyia.jp';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN;
const INFLUX_ORG = process.env.INFLUX_ORG || 'my-org';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'discord-metrics';
const INFLUX_USER = process.env.INFLUX_USER;
const INFLUX_PASSWORD = process.env.INFLUX_PASSWORD;

if (!INFLUX_TOKEN && !(INFLUX_USER && INFLUX_PASSWORD)) {
  console.error('Either INFLUX_TOKEN or INFLUX_USER+INFLUX_PASSWORD must be set in env');
  process.exit(1);
}

const writeLine = `bot_status,bot=mitarashi-bot alive=true`;
const writeUrl = `${INFLUX_URL.replace(/\/+$/, '')}/api/v2/write?org=${encodeURIComponent(INFLUX_ORG)}&bucket=${encodeURIComponent(INFLUX_BUCKET)}&precision=s`;
const parsed = url.parse(writeUrl);
const body = writeLine;

const opts = {
  hostname: parsed.hostname,
  port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
  path: parsed.path,
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
    'Content-Length': Buffer.byteLength(body)
  }
};

if (INFLUX_TOKEN) {
  opts.headers.Authorization = `Token ${INFLUX_TOKEN}`;
} else {
  const basic = Buffer.from(`${INFLUX_USER}:${INFLUX_PASSWORD}`).toString('base64');
  opts.headers.Authorization = `Basic ${basic}`;
}

const client = parsed.protocol === 'https:' ? https : http;

const req = client.request(opts, (res) => {
  console.log(`status: ${res.statusCode}`);
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('response:', data || '<empty>'));
});

req.on('error', (err) => {
  console.error('request error', err);
});

req.write(body);
req.end();
