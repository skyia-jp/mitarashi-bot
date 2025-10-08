import { SHOP_ITEM_REMOVE_SELECT_ID, handleShopItemRemoveSelect } from '../../commands/utility/shop.js';

export default {
  customId: SHOP_ITEM_REMOVE_SELECT_ID,
  async execute(client, interaction) {
    await handleShopItemRemoveSelect(interaction);
  }
};
