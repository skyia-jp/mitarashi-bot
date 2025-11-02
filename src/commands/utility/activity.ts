import { SlashCommandBuilder, Client, ChatInputCommandInteraction } from 'discord.js';
import { getActivityLeaderboard } from '../../services/activityService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('サーバーアクティビティを確認します')
    .addSubcommand((sub) =>
      sub
        .setName('leaderboard')
        .setDescription('活動量ランキングを表示します')
        .addIntegerOption((option) => option.setName('days').setDescription('対象期間 (1-30日)').setMinValue(1).setMaxValue(30))
        .addIntegerOption((option) => option.setName('limit').setDescription('表示件数 (1-20)').setMinValue(1).setMaxValue(20))
    ),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'leaderboard') {
      await interaction.deferReply({ ephemeral: true });
      const days = interaction.options.getInteger('days') ?? 7;
      const limit = interaction.options.getInteger('limit') ?? 10;
      const records = (await getActivityLeaderboard(interaction.guildId as string, days, limit)) as any[];

      if (!records.length) {
        await interaction.editReply({ content: 'データがまだありません。' });
        return;
      }

      const description = records
        .map((entry, index) => {
          const name = entry.user?.username ?? entry.user?.discordId ?? 'Unknown';
          return `${index + 1}. **${name}** - メッセージ ${entry.messageCount}件 / VC ${entry.voiceMinutes}分`;
        })
        .join('\n');

      await interaction.editReply({
        embeds: [
          {
            title: `📊 過去${days}日のアクティビティランキング`,
            description,
            color: 0x1abc9c,
            timestamp: new Date().toISOString()
          }
        ]
      });
    }
  }
};
