import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getPasswordReveal } from '../../services/passwordRevealService.js';

const BASE_CUSTOM_ID = 'pwd_reveal';

function buildModalCustomId(customId) {
  return `pwd_reveal_modal:${customId.split(':')[1] ?? customId}`;
}

export default {
  customId: BASE_CUSTOM_ID,
  async execute(client, interaction) {
    const entry = await getPasswordReveal(interaction.customId);

    if (!entry) {
      await interaction.reply({
        content: 'パスワード情報が見つかりませんでした。設定者に確認してください。',
        ephemeral: true
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(buildModalCustomId(interaction.customId))
      .setTitle(entry.title ?? 'パスワードの確認');

    const passwordInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('イベント参加用パスワード')
      .setValue(entry.password)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(passwordInput);

    await interaction.showModal(modal.addComponents(row));
  }
};
