import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { ensureLogChannel } from '../../services/moderationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('モデレーションログを送信するチャンネルを設定します')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('ログチャンネルにしたいテキストチャンネル')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(client, interaction) {
    // server-side safety: ensure caller has Administrator permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'このコマンドはサーバーの管理者のみ実行できます。', ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel('channel', true);
    // basic validation: ensure the channel belongs to the same guild
    if (!channel || channel.guild?.id !== interaction.guildId) {
      await interaction.reply({ content: '指定したチャンネルはこのサーバーに存在しません。', ephemeral: true });
      return;
    }

    try {
      await ensureLogChannel(interaction, channel);
      await interaction.reply({ content: `📝 ログチャンネルを ${channel} に設定しました。`, ephemeral: true });
    } catch (err) {
      // If DB write or other error occurs, surface a friendly message
      await interaction.reply({ content: 'ログチャンネルの設定に失敗しました。管理者に問い合わせてください。', ephemeral: true });
      throw err;
    }
  }
};
