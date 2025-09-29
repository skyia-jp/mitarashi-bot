import 'dotenv/config';
import BotClient from './bot/client.js';
import logger from './utils/logger.js';

async function main() {
  try {
    const client = new BotClient();
    await client.init();
  } catch (error) {
    logger.error(error, 'Failed to start bot');
    process.exitCode = 1;
  }
}

main();
