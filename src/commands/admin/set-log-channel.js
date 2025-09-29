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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(client, interaction) {
    const channel = interaction.options.getChannel('channel', true);
    await ensureLogChannel(interaction, channel);
    await interaction.reply({ content: `📝 ログチャンネルを ${channel} に設定しました。`, ephemeral: true });
  }
};
