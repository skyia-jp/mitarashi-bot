import { SlashCommandBuilder, Client, ChatInputCommandInteraction, TextChannel, Message, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
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
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const messageId = interaction.options.getString('message_id', false);
    const all = interaction.options.getBoolean('all');
    const channel = interaction.channel as TextChannel;
    if (subcommand === 'add') {
      const message = await channel.messages.fetch(messageId!).catch(() => null);
      if (!message) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription('❌ 指定したメッセージが見つかりません。');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      await pinMessage(interaction, message as Message);
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📌 メッセージ固定')
        .setDescription(`メッセージ ${messageId} を固定しました。以後、新しい投稿後も末尾に再掲されます。`);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // If 'all' flag is provided and true, remove all pinned messages in this channel
    if (all) {
      // require manage messages permission to perform mass-unpin
      // interaction.memberPermissions may be undefined in some contexts; fallback to member.permissions
      const perms =
        interaction.memberPermissions ??
        (interaction.member ? (interaction.member as import('discord.js').GuildMember).permissions : null);
      const canManage = perms ? perms.has(PermissionFlagsBits.ManageMessages) || perms.has(PermissionFlagsBits.Administrator) : false;
      if (!canManage) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription('❌ この操作を行うにはメッセージ管理権限が必要です。');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const { unpinAllInChannel } = await import('../../services/pinService.js');
      const count = await unpinAllInChannel(interaction, channel);
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('📍 ピン一括解除')
        .setDescription(`このチャンネルのピンをすべて解除しました。合計: ${count} 件。`);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (!messageId) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription('❌ message_id を指定するか all=true を指定してください。');
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const existingMessage = await channel.messages.fetch(messageId).catch(() => null);

      try {
      await unpinMessage(
        interaction,
        existingMessage ?? ({
          id: messageId,
          channel
        })
      );
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('📍 ピン解除')
        .setDescription(`メッセージ ${messageId} の固定を解除しました。`);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription('❌ 指定したメッセージの固定情報が見つかりませんでした。');
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
