import { refreshPinnedMessagePosition } from '../../services/pinService.js';
import { recordMessageActivity } from '../../services/activityService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';
import { createModuleLogger } from '../../utils/logger.js';

const logger = createModuleLogger('events:messageCreate');

export default {
  name: 'messageCreate',

  async execute(client, message) {
    if (!message.guild || message.author?.bot || message.webhookId || message.system) return;

    if (message.partial) {
      try {
        await message.fetch();
      } catch (err) {
        logger.warn({ err }, 'Failed to fetch partial message');
        return;
      }
    }

    refreshPinnedMessagePosition(message.channel).catch((err) => {
      logger.debug({ err }, 'refreshPinnedMessagePosition error');
    });

    const botId = client.user?.id;
    const isBotMention = Boolean(botId && message.mentions?.users?.has && message.mentions.users.has(botId));

    const prefix = client?.config?.prefix ?? process.env.COMMAND_PREFIX ?? '!';
    const content = typeof message.content === 'string' ? message.content.trimStart() : '';
    const isCommand = content.startsWith(prefix);

    if (!isBotMention && !isCommand) return;

    let user;
    try {
      user = await getOrCreateUser(message.author);
    } catch (err) {
      logger.error({ err }, 'getOrCreateUser failed');
      return;
    }

    recordMessageActivity(message.guild.id, user.id).catch((err) => {
      logger.error({ err }, 'recordMessageActivity failed');
    });
  }
};