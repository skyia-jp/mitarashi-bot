import { SlashCommandBuilder } from 'discord.js';
import { pinMessage, unpinMessage } from '../../services/pinService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pin')
    .setDescription('メッセージピン留めを管理します')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('メッセージをピン留めします')
        .addStringOption((option) =>
          option.setName('message_id').setDescription('ピン留めしたいメッセージID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('メッセージのピン留めを解除します')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('ピン留めを解除したいメッセージID')
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName('all')
            .setDescription('このチャンネルのすべてのピンを解除します (true/false)')
            .setRequired(false)
        )
    ),
  async execute(client, interaction) {
    const subcommand = interaction.options.getSubcommand();
  const messageId = interaction.options.getString('message_id', false);
  const all = interaction.options.getBoolean('all');
    const channel = interaction.channel;
    if (subcommand === 'add') {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        await interaction.reply({ content: '指定したメッセージが見つかりません。', ephemeral: true });
        return;
      }

      await pinMessage(interaction, message);
      await interaction.reply({
        content: `📌 メッセージ ${messageId} を固定しました。以後、新しい投稿後も末尾に再掲されます。`,
        ephemeral: true
      });
      return;
    }

    // If 'all' flag is provided and true, remove all pinned messages in this channel
    if (all) {
      const { unpinAllInChannel } = await import('../../services/pinService.js');
      const count = await unpinAllInChannel(interaction, channel);
      await interaction.reply({
        content: `📍 このチャンネルのピンをすべて解除しました。合計: ${count} 件。`,
        ephemeral: true
      });
      return;
    }

    if (!messageId) {
      await interaction.reply({ content: 'message_id を指定するか all=true を指定してください。', ephemeral: true });
      return;
    }

    const existingMessage = await channel.messages.fetch(messageId).catch(() => null);

    try {
      await unpinMessage(
        interaction,
        existingMessage ?? {
          id: messageId,
          channel
        }
      );
      await interaction.reply({
        content: `📍 メッセージ ${messageId} の固定を解除しました。`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '指定したメッセージの固定情報が見つかりませんでした。',
        ephemeral: true
      });
    }
  }
};
