import { SHOP_ANNOUNCE_DELETE_SELECT_ID, handleShopAnnounceDeleteSelect } from '../../commands/utility/shop.js';
import type { Client, StringSelectMenuInteraction } from 'discord.js';

export default {
  customId: SHOP_ANNOUNCE_DELETE_SELECT_ID,
  async execute(client: Client, interaction: StringSelectMenuInteraction) {
    await handleShopAnnounceDeleteSelect(interaction);
  }
};
