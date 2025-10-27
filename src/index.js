import 'dotenv/config';
import BotClient from './bot/client.js';
import { createLogger } from './utils/logger.js';
import { startBotMetrics, stopBotMetrics } from './utils/influxMetrics.js';
import http from 'node:http';
import prisma from './database/client.js';

const bootstrapLogger = createLogger({ module: 'bootstrap' });

function setupProcessHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    const payload = {
      promise: promise ? { constructorName: promise.constructor?.name ?? 'Promise' } : undefined
    };

    if (reason instanceof Error) {
      payload.err = reason;
    } else {
      payload.reason = reason;
    }

    bootstrapLogger.error(
      {
        ...payload,
        event: 'process.unhandled_rejection'
      },
      'Unhandled promise rejection'
    );
  });

  process.on('uncaughtException', (error) => {
    bootstrapLogger.fatal(
      {
        err: error,
        event: 'process.uncaught_exception'
      },
      'Uncaught exception'
    );
    process.exitCode = 1;
    throw error;
  });

  // Note: actual graceful shutdown actions are wired in main() where we have access to
  // the running client and HTTP server. These handlers merely log.
  const handleTermination = (signal) => {
    bootstrapLogger.info({ event: 'process.termination_signal', signal }, 'Received termination signal');
  };

  process.on('SIGTERM', handleTermination);
  process.on('SIGINT', handleTermination);
}

async function main() {
  try {
    setupProcessHandlers();
    // start periodic metrics (interval can be set via METRICS_SEND_INTERVAL_MS)
    try {
      const interval = Number(process.env.METRICS_SEND_INTERVAL_MS || 10000);
      startBotMetrics(interval);
    } catch (err) {
      bootstrapLogger.warn({ err }, 'Failed to start bot metrics (continuing startup)');
    }

    // Lightweight HTTP health server for Kubernetes probes
    const PORT = Number(process.env.HEALTH_PORT || process.env.PORT || 8080);
    let isReady = false;

    const server = http.createServer(async (req, res) => {
      if (req.url === '/live') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        return;
      }

      if (req.url === '/ready') {
        // Check app readiness: bot ready and DB reachable
        if (!isReady) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('NOT_READY');
          return;
        }

        try {
          // quick DB check
          await prisma.$queryRaw`SELECT 1`;
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        } catch (err) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('DB_UNAVAILABLE');
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(PORT, () => {
      bootstrapLogger.info({ event: 'health.server.started', port: PORT }, 'Health server listening');
    });

    const client = new BotClient();

    // mark readiness when bot emits ready
    client.once('ready', () => {
      isReady = true;
    });

    await client.init();

    // Graceful shutdown wiring
    const gracefulShutdown = async (signal) => {
      bootstrapLogger.info({ event: 'shutdown.start', signal }, 'Graceful shutdown starting');
      try {
        // stop metrics and flush
        stopBotMetrics();
      } catch (err) {
        bootstrapLogger.warn({ err, event: 'shutdown.metrics' }, 'Error stopping metrics');
      }

      try {
        await prisma.$disconnect();
      } catch (err) {
        bootstrapLogger.warn({ err, event: 'shutdown.prisma' }, 'Error disconnecting Prisma');
      }

      try {
        if (client) {
          await client.destroy();
        }
      } catch (err) {
        bootstrapLogger.warn({ err, event: 'shutdown.client' }, 'Error destroying client');
      }

      try {
        server.close(() => {
          bootstrapLogger.info({ event: 'shutdown.http.closed' }, 'Health server closed');
          process.exit(0);
        });
      } catch (err) {
        bootstrapLogger.warn({ err, event: 'shutdown.http' }, 'Error closing HTTP server');
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    bootstrapLogger.fatal(
      {
        err: error,
        event: 'bot.startup.failed'
      },
      'Failed to start bot'
    );
    process.exitCode = 1;
  }
}

main();
