import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prisma = new PrismaClient({
  log: ['warn', 'error']
});

if (!globalThis.__prismaBeforeExitHandler) {
  globalThis.__prismaBeforeExitHandler = true;
  process.once('beforeExit', async () => {
    logger.info('Prisma client disconnecting');
    try {
      await prisma.$disconnect();
    } catch (error) {
      logger.error({ err: error }, 'Failed to disconnect Prisma client');
    }
  });
}

export default prisma;
