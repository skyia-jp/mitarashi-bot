import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addTerm } from '../../services/filterService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('filteradd')
    .setDescription('禁止用語を追加します')
    .addStringOption((option) =>
      option.setName('term').setDescription('禁止する単語').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('severity')
        .setDescription('重大度 (1-5)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(client, interaction) {
    const term = interaction.options.getString('term', true);
    const severity = interaction.options.getInteger('severity') ?? 1;
    await addTerm(interaction, term, severity);
    await interaction.reply({ content: `🚫 禁止用語 \\"${term}\\" を追加しました。`, ephemeral: true });
  }
};
