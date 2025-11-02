import { SlashCommandBuilder, Client, ChatInputCommandInteraction } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Bot の応答速度を表示します'),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    // fetchReply オプションは非推奨なので、まず reply() してから fetchReply() で取得する
    await interaction.reply({ content: 'Pinging...' });
    const sent = await interaction.fetchReply();
    const latency = (sent as import('discord.js').Message).createdTimestamp - interaction.createdTimestamp;
    // client.ws.ping は number 型として取得できます
    await interaction.editReply(`🏓 Pong! Latency: ${latency}ms, Websocket: ${Math.round(client.ws.ping)}ms`);
  }
};
