import { SHOP_CANCEL_ID, handleShopCancel } from '../../commands/utility/shop.js';

export default {
  customId: SHOP_CANCEL_ID,
  async execute(client, interaction) {
    const [, sessionId] = interaction.customId.split(':');
    if (!sessionId) {
      await interaction.reply({ content: '購入セッションIDが見つかりませんでした。', ephemeral: true });
      return;
    }

    await handleShopCancel(interaction, sessionId);
  }
};
