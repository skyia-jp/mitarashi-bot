import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Bot の応答速度を表示します'),
  async execute(client, interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`🏓 Pong! Latency: ${latency}ms, Websocket: ${Math.round(client.ws.ping)}ms`);
  }
};
