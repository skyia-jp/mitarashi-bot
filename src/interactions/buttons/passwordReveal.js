import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const BUTTON_CUSTOM_ID = 'pwd_reveal';
const MODAL_CUSTOM_ID = 'pwd_reveal_modal';

export default {
  customId: BUTTON_CUSTOM_ID,
  async execute(client, interaction) {
    const modal = new ModalBuilder()
      .setCustomId(MODAL_CUSTOM_ID)
      .setTitle('パスワード認証');

    const passwordInput = new TextInputBuilder()
      .setCustomId('password')
      .setStyle(TextInputStyle.Short)
      .setLabel('パスワードを入力してください')
      .setPlaceholder('ここに入力してください')
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(passwordInput);

    await interaction.showModal(modal.addComponents(row));
  }
};
