import 'dotenv/config';
import BotClient from './bot/client.js';
import { createLogger } from './utils/logger.js';

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

  const handleTermination = (signal) => {
  bootstrapLogger.info({ event: 'process.termination_signal', signal }, 'Received termination signal, shutting down');
    process.exitCode = 0;
    process.off('SIGTERM', handleTermination);
    process.off('SIGINT', handleTermination);
    process.kill(process.pid, signal);
  };

  process.on('SIGTERM', handleTermination);
  process.on('SIGINT', handleTermination);
}

async function main() {
  try {
    setupProcessHandlers();
    const client = new BotClient();
    await client.init();
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
