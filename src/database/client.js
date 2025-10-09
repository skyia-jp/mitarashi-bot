import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../utils/logger.js';

const prismaLogger = createModuleLogger('database:prisma');

const prisma = new PrismaClient({
  log: ['warn', 'error']
});

if (!globalThis.__prismaBeforeExitHandler) {
  globalThis.__prismaBeforeExitHandler = true;
  process.once('beforeExit', async () => {
    prismaLogger.info({ event: 'prisma.disconnect.start' }, 'Prisma client disconnecting');
    try {
      await prisma.$disconnect();
    } catch (error) {
      prismaLogger.error({ err: error, event: 'prisma.disconnect.error' }, 'Failed to disconnect Prisma client');
    }
  });
}

export default prisma;
