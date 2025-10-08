import { SHOP_ANNOUNCE_DELETE_SELECT_ID, handleShopAnnounceDeleteSelect } from '../../commands/utility/shop.js';

export default {
  customId: SHOP_ANNOUNCE_DELETE_SELECT_ID,
  async execute(client, interaction) {
    await handleShopAnnounceDeleteSelect(interaction);
  }
};
