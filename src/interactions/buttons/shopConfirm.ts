import { SHOP_CONFIRM_ID, handleShopConfirm } from '../../commands/utility/shop.js';
import type { Client, ButtonInteraction } from 'discord.js';

export default {
  customId: SHOP_CONFIRM_ID,
  async execute(client: Client, interaction: ButtonInteraction) {
    const [, sessionId] = interaction.customId.split(':');
    if (!sessionId) {
      await interaction.reply({ content: '購入セッションIDが見つかりませんでした。', ephemeral: true });
      return;
    }

    await handleShopConfirm(interaction, sessionId);
  }
};
