import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction, GuildTextBasedChannel } from 'discord.js';
import { ensureLogChannel } from '../../services/moderationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('モデレーションログを送信するチャンネルを設定します')
    .addChannelOption((option) =>
      option.setName('channel').setDescription('ログチャンネルにしたいテキストチャンネル').addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    // server-side safety: ensure caller has Administrator permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'このコマンドはサーバーの管理者のみ実行できます。', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true) as GuildTextBasedChannel | null;
    // basic validation: ensure the channel belongs to the same guild
    if (!channel || channel.guild?.id !== interaction.guildId) {
      await interaction.reply({ content: '指定したチャンネルはこのサーバーに存在しません。', ephemeral: true });
      return;
    }

    // Defer because ensureLogChannel may perform DB writes
    await interaction.deferReply({ flags: 1 << 6 }).catch(() => null);

    try {
      await ensureLogChannel(interaction, channel);
      await interaction.editReply({ content: `📝 ログチャンネルを ${channel} に設定しました。` }).catch(() => null);
    } catch (err: any) {
      // If DB write or other error occurs, surface a friendly message
      await interaction.editReply({ content: 'ログチャンネルの設定に失敗しました。管理者に問い合わせてください。' }).catch(() => null);
      throw err;
    }
  }
};
