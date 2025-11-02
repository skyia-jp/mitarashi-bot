import { SHOP_SELECT_ID, handleShopSelect } from '../../commands/utility/shop.js';
import type { Client, StringSelectMenuInteraction } from 'discord.js';

export default {
  customId: SHOP_SELECT_ID,
  async execute(client: Client, interaction: StringSelectMenuInteraction) {
    await handleShopSelect(interaction);
  }
};
