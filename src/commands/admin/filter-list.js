import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { listFilterTerms } from '../../database/repositories/filterRepository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('filterlist')
    .setDescription('禁止用語リストを表示します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(client, interaction) {
    const terms = await listFilterTerms(interaction.guildId);
    if (!terms.length) {
      await interaction.reply({ content: '禁止用語は登録されていません。', ephemeral: true });
      return;
    }

    const description = terms
      .map((term, index) => `${index + 1}. ${term.term} (severity: ${term.severity})`)
      .join('\n');

    await interaction.reply({
      embeds: [
        {
          title: '🚫 禁止用語リスト',
          description,
          color: 0xff5555
        }
      ],
      ephemeral: true
    });
  }
};
