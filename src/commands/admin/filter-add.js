import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addTerm, FilterTermExistsError, InvalidFilterTermError } from '../../services/filterService.js';

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
    try {
      const normalized = await addTerm(interaction, term, severity);
      await interaction.reply({ content: `🚫 禁止用語 "${normalized}" を追加しました。`, ephemeral: true });
    } catch (error) {
      if (error instanceof InvalidFilterTermError) {
        await interaction.reply({ content: '⚠️ 禁止用語は1文字以上で入力してください。', ephemeral: true });
        return;
      }
      if (
        error instanceof FilterTermExistsError ||
        error?.code === 'FILTER_TERM_EXISTS' ||
        error?.name === 'FilterTermExistsError'
      ) {
        const { term, existingTerm } = error;
        const normalizedTerm = typeof term === 'string' ? term : interaction.options.getString('term', true);
        const message = existingTerm && existingTerm !== normalizedTerm
          ? `⚠️ 禁止用語 "${normalizedTerm}" は既に "${existingTerm}" として登録されています。`
          : `⚠️ 禁止用語 "${normalizedTerm}" はすでに登録されています。`;
        await interaction.reply({ content: message, ephemeral: true });
        return;
      }
      throw error;
    }
  }
};
