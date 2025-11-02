import { SHOP_ITEM_REMOVE_SELECT_ID, handleShopItemRemoveSelect } from '../../commands/utility/shop.js';
import type { Client, StringSelectMenuInteraction } from 'discord.js';

export default {
  customId: SHOP_ITEM_REMOVE_SELECT_ID,
  async execute(client: Client, interaction: StringSelectMenuInteraction) {
    await handleShopItemRemoveSelect(interaction);
  }
};
