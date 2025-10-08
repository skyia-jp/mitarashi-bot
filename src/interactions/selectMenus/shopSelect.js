import { SHOP_SELECT_ID, handleShopSelect } from '../../commands/utility/shop.js';

export default {
  customId: SHOP_SELECT_ID,
  async execute(client, interaction) {
    await handleShopSelect(interaction);
  }
};
