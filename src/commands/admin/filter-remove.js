import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { deleteTerm } from '../../services/filterService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('filterremove')
    .setDescription('禁止用語を削除します')
    .addStringOption((option) =>
      option.setName('term').setDescription('削除する単語').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(client, interaction) {
    const term = interaction.options.getString('term', true);
    await deleteTerm(interaction.guildId, term);
    await interaction.reply({ content: `✅ 禁止用語 \\"${term}\\" を削除しました。`, ephemeral: true });
  }
};
