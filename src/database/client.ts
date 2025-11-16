import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../utils/logger.js';

const prismaLogger = createModuleLogger('database:prisma') as any;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=5'
    }
  }
});

if (!(globalThis as any).__prismaBeforeExitHandler) {
  (globalThis as any).__prismaBeforeExitHandler = true;
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
