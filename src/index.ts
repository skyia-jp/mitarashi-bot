import 'dotenv/config';
import BotClient from './bot/client.ts';
import { createLogger } from './utils/logger.js';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const bootstrapLogger = createLogger({ module: 'bootstrap' }) as any;

function setupProcessHandlers() {
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const payload: any = {
      promise: promise ? { constructorName: (promise as any).constructor?.name ?? 'Promise' } : undefined
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
    if (reason instanceof Error) {
      // eslint-disable-next-line no-console
      console.error('Unhandled promise rejection:', reason.stack || reason);
    } else {
      // eslint-disable-next-line no-console
      console.error('Unhandled promise rejection (non-error):', reason);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    bootstrapLogger.fatal(
      {
        err: error,
        event: 'process.uncaught_exception'
      },
      'Uncaught exception'
    );
    // eslint-disable-next-line no-console
    console.error('Uncaught exception:', error.stack || error);
    // In development, avoid hard-exiting so the dev server can stay up and we can inspect the error.
    // Set an exitCode for CI/monitoring, but do not call process.exit when developing locally.
    process.exitCode = 1;
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  const handleTermination = (signal: NodeJS.Signals) => {
    bootstrapLogger.info({ event: 'process.termination_signal', signal }, 'Received termination signal, shutting down');
    process.exitCode = 0;
    process.off('SIGTERM', handleTermination as any);
    process.off('SIGINT', handleTermination as any);
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
    if (process.env.NODE_ENV !== 'production' && typeof (globalThis as any).Bun === 'undefined') {
      const problematic: Array<{ jsPath: string; tsPath: string }> = [];
      const scanDirs = [path.join('.', 'src', 'bot', 'events'), path.join('.', 'src', 'interactions'), path.join('.', 'src', 'commands')];
      for (const dir of scanDirs) {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isFile() && e.name.endsWith('.js')) {
              const jsPath = path.join(dir, e.name);
              const tsPath = jsPath.replace(/\.js$/, '.ts');
              // check sibling .ts existence
              try {
                await access(tsPath);
              } catch (_err) {
                // ts not present
                continue;
              }
              // read content to detect stub marker
              const content = await readFile(jsPath, { encoding: 'utf8' }).catch(() => '');
              if (content.includes('Stubbed during TypeScript migration') || content.includes('no-op stub')) {
                problematic.push({ jsPath, tsPath });
              }
            }
          }
        } catch (_err) {
          // ignore missing directories
        }
      }

      if (problematic.length && !process.env.SKIP_STUB_CHECK) {
        const msg = `Detected ${problematic.length} JS stub modules with TypeScript counterparts while running under Node. This usually means you're running with Node which will load no-op stubs instead of the real .ts implementations. Run with Bun (npm run dev:bun) or use 'npm run dev:node' (ts-node) to run TypeScript implementations, or set SKIP_STUB_CHECK=1 to bypass this check.`;
        createLogger({ module: 'bootstrap' }).fatal({ event: 'bootstrap.stub_check_failed', files: problematic }, msg);
        process.exit(1);
      }

    }

    const client = new BotClient();
    await client.init();
    // If startup succeeded in development, ensure the process exit code is reset to 0 so dev runners
    // don't report a failing exit prematurely. In production we still allow non-zero codes to surface.
    if (process.env.NODE_ENV !== 'production') {
      process.exitCode = 0;
      bootstrapLogger.info({ event: 'bootstrap.startup_ok' }, 'Startup completed; dev exitCode set to 0');
    }
    // In development, keep the process alive so the dev runner doesn't observe a premature exit.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Development mode: entering keep-alive loop. Press Ctrl+C to stop.');
      // never-resolving promise to keep Node/Bun process alive
      // eslint-disable-next-line no-constant-condition
      await new Promise(() => {});
    }
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
