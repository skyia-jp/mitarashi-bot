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
    // also print to stderr to ensure visibility in environments where logger may be buffered
    if (reason instanceof Error) {
      // eslint-disable-next-line no-console
      console.error('Unhandled promise rejection:', reason.stack || reason);
    } else {
      // eslint-disable-next-line no-console
      console.error('Unhandled promise rejection (non-error):', reason);
    }
  });

  process.on('uncaughtException', (error) => {
    bootstrapLogger.fatal(
      {
        err: error,
        event: 'process.uncaught_exception'
      },
      'Uncaught exception'
    );
    // ensure stack is printed to stderr in addition to structured log
    // eslint-disable-next-line no-console
    console.error('Uncaught exception:', error.stack || error);
    process.exitCode = 1;
    // terminate gracefully
    process.exit(1);
  });

  const handleTermination = (signal) => {
  bootstrapLogger.info({ event: 'process.termination_signal', signal }, 'Received termination signal, shutting down');
    process.exitCode = 0;
    process.off('SIGTERM', handleTermination);
    process.off('SIGINT', handleTermination);
    process.kill(process.pid, signal);
  };

  process.on('exit', (code) => {
    // eslint-disable-next-line no-console
    console.error(`Process exiting with code: ${code}`);
    bootstrapLogger.info({ event: 'process.exit', code }, 'Process exiting');
  });

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
