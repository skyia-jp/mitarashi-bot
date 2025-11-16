import { SlashCommandBuilder, Client, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Bot の応答速度を表示します'),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const wsLatency = Math.round(client.ws.ping);
    
    const start = Date.now();
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🏓 Pong!')
          .addFields(
            { name: 'WebSocket', value: `${wsLatency}ms`, inline: true },
            { name: 'API RTT', value: '計測中...', inline: true }
          )
          .setTimestamp()
      ]
    });
    const rtt = Date.now() - start;
    
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🏓 Pong!')
          .addFields(
            { name: 'WebSocket', value: `${wsLatency}ms`, inline: true },
            { name: 'API RTT', value: `${rtt}ms`, inline: true }
          )
          .setTimestamp()
      ]
    });
  }
};
