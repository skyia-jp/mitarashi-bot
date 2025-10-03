import { refreshPinnedMessagePosition } from '../../services/pinService.js';
import { recordMessageActivity } from '../../services/activityService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

export default {
  name: 'messageCreate',
  async execute(client, message) {
    if (!message.guild || message.author.bot) return;

    if (message.partial) {
      try {
        await message.fetch();
      } catch (error) {
        return;
      }
    }

    const user = await getOrCreateUser(message.author);
    await Promise.all([
      refreshPinnedMessagePosition(message.channel).catch(() => null),
      recordMessageActivity(message.guild.id, user.id).catch(() => null)
    ]);
  }
};
