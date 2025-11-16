import { endVoiceSession, startVoiceSession } from '../../services/activityService.js';
import type { Client, VoiceState } from 'discord.js';

export default {
  name: 'voiceStateUpdate',
  async execute(client: Client, oldState: VoiceState, newState: VoiceState) {
    if (!newState.guild || newState.member?.user?.bot) return;

    const guildId = newState.guild.id;
    const userId = (newState.member?.user ?? oldState.member?.user)?.id;
    if (!userId) return;

    if (!oldState.channelId && newState.channelId) {
      startVoiceSession(guildId, userId);
      return;
    }

    if (oldState.channelId && !newState.channelId) {
      await endVoiceSession(guildId, userId);
      return;
    }

    if (oldState.channelId !== newState.channelId) {
      await endVoiceSession(guildId, userId);
      startVoiceSession(guildId, userId);
    }
  }
};
