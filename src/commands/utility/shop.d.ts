import type { Interaction, ButtonInteraction, StringSelectMenuInteraction, ChatInputCommandInteraction } from 'discord.js';

export const SHOP_SELECT_ID: string;
export const SHOP_CONFIRM_ID: string;
export const SHOP_CANCEL_ID: string;
export const SHOP_ITEM_REMOVE_SELECT_ID: string;
export const SHOP_ANNOUNCE_DELETE_SELECT_ID: string;

export function handleShopSelect(interaction: StringSelectMenuInteraction): Promise<void>;
export function handleShopCancel(interaction: ButtonInteraction, sessionId: string): Promise<void>;
export function handleShopConfirm(interaction: ButtonInteraction, sessionId: string): Promise<void>;
export function handleShopItemRemoveSelect(interaction: StringSelectMenuInteraction): Promise<void>;
export function handleShopAnnounceDeleteSelect(interaction: StringSelectMenuInteraction): Promise<void>;

export default function execute(client: any, interaction: ChatInputCommandInteraction | Interaction): Promise<void>;
