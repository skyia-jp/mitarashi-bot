import { containsFilteredTerm, ensureTerms } from '../../services/filterService.js';
import { getLogChannel } from '../../services/moderationService.js';
import { refreshPinnedMessagePosition } from '../../services/pinService.js';
import { recordMessageActivity } from '../../services/activityService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';
import logger from '../../utils/logger.js';

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

    await ensureTerms(message.guild.id);
    if (containsFilteredTerm(message.guild.id, message.content)) {
      await message.delete().catch(() => null);
      const logChannel = await getLogChannel(message.guild);
      if (logChannel) {
        await logChannel.send({
          embeds: [
            {
              title: '⚠️ 禁止用語を検出しました',
              description: `ユーザー: ${message.author} (ID: ${message.author.id})\nチャンネル: ${message.channel} \n内容: ${message.content}`,
              color: 0xff5555,
              timestamp: new Date().toISOString()
            }
          ]
        });
      }

      logger.warn({ userId: message.author.id }, 'Filtered message removed');
      return;
    }

    const user = await getOrCreateUser(message.author);
    await Promise.all([
      refreshPinnedMessagePosition(message.channel).catch(() => null),
      recordMessageActivity(message.guild.id, user.id).catch(() => null)
    ]);
  }
};
