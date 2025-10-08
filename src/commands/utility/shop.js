import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import prisma from '../../database/client.js';
import logger from '../../utils/logger.js';
import { CurrencyError, debit } from '../../services/currencyService.js';

export const SHOP_SELECT_ID = 'shop_select';
export const SHOP_CONFIRM_ID = 'shop_confirm';
export const SHOP_CANCEL_ID = 'shop_cancel';
export const SHOP_ITEM_REMOVE_SELECT_ID = 'shop_item_remove';
export const SHOP_ANNOUNCE_DELETE_SELECT_ID = 'shop_announce_delete';
const SELECT_NOOP_VALUE = 'noop';

const SESSION_TTL_MS = 5 * 60 * 1000;

const purchaseSessions = new Map();

function formatPrice(value) {
  return `${value} コイン`;
}

function buildItemEmbed(item) {
  return new EmbedBuilder()
    .setTitle(item.name)
    .setDescription([
      `価格: ${formatPrice(item.price)}`,
      item.description ? item.description : '説明はありません。'
    ].join('\n'))
    .setFooter({ text: item.id })
    .setTimestamp(new Date());
}

function truncate(text, maxLength) {
  if (!text) return undefined;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function createSession(data) {
  const sessionId = randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const timeout = setTimeout(() => {
    purchaseSessions.delete(sessionId);
  }, SESSION_TTL_MS).unref?.() ?? setTimeout(() => purchaseSessions.delete(sessionId), SESSION_TTL_MS);

  purchaseSessions.set(sessionId, { ...data, expiresAt, timeout });
  return sessionId;
}

function getSession(sessionId) {
  const session = purchaseSessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    clearSession(sessionId);
    return null;
  }
  return session;
}

function clearSession(sessionId) {
  const session = purchaseSessions.get(sessionId);
  if (session?.timeout) {
    clearTimeout(session.timeout);
  }
  purchaseSessions.delete(sessionId);
}

async function handleItemAdd(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'ギルド内でのみ利用できます。', ephemeral: true });
    return;
  }

  const name = interaction.options.getString('name', true);
  const price = interaction.options.getInteger('price', true);
  const description = interaction.options.getString('description') ?? null;
  const role = interaction.options.getRole('role');

  const id = randomUUID();

  await prisma.shopItem.create({
    data: {
      id,
      guildId,
      name,
      description,
      price,
      roleId: role ? role.id : null,
      createdBy: interaction.user.id
    }
  });

  await interaction.reply({ content: 'アイテムを追加しました。', ephemeral: true });
}

async function handleItemRemove(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'ギルド内でのみ利用できます。', ephemeral: true });
    return;
  }

  const items = await prisma.shopItem.findMany({
    where: { guildId },
    orderBy: [{ name: 'asc' }, { price: 'asc' }]
  });

  if (items.length === 0) {
    await interaction.reply({ content: '削除可能なアイテムがありません。', ephemeral: true });
    return;
  }

  const limitedItems = items.slice(0, 24);
  const menu = buildSelectMenuWithDefault(
    SHOP_ITEM_REMOVE_SELECT_ID,
    '削除するアイテムを選択してください',
    limitedItems.map((item) => ({
      label: truncate(item.name, 100) ?? item.name,
      description: truncate(item.description ?? '説明はありません。', 100),
      value: item.id
    }))
  );

  const components = [new ActionRowBuilder().addComponents(menu)];
  const extraMessage = items.length > limitedItems.length
    ? '最新の24件のみ表示しています。それ以外を削除する場合は先に削除してから再度実行してください。'
    : null;

  await interaction.reply({
    content: [
      '削除するアイテムを選択してください。',
      extraMessage
    ].filter(Boolean).join('\n'),
    components,
    ephemeral: true
  });
}

function buildSelectMenu(items) {
  return buildSelectMenuWithDefault(
    SHOP_SELECT_ID,
    '購入するアイテムを選択してください',
    items.map((item) => ({
      label: truncate(item.name, 100) ?? item.name,
      description: truncate(item.description ?? '説明はありません。', 100),
      value: item.id
    }))
  );
}

function buildSelectMenuWithDefault(customId, placeholder, options) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions({
      label: '選択してください',
      value: SELECT_NOOP_VALUE,
      description: '操作をキャンセルする場合はこちらを選択してください。'
    });

  if (options.length > 0) {
    menu.addOptions(options.slice(0, 24));
  }

  return menu;
}

async function handleAnnounceSend(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'ギルド内でのみ利用できます。', ephemeral: true });
    return;
  }

  const targetChannel = interaction.options.getChannel('channel', true);
  if (!targetChannel.isTextBased()) {
    await interaction.reply({ content: 'テキストチャンネルを指定してください。', ephemeral: true });
    return;
  }

  const items = await prisma.shopItem.findMany({
    where: { guildId },
    orderBy: [{ name: 'asc' }, { price: 'asc' }]
  });

  if (items.length === 0) {
    await interaction.reply({ content: '登録されているアイテムがありません。', ephemeral: true });
    return;
  }

  const pages = chunk(items, 24);
  const totalPages = pages.length;

  for (let index = 0; index < pages.length; index += 1) {
    const pageItems = pages[index];
    const embed = new EmbedBuilder()
      .setTitle('ショップ一覧')
      .setColor(0x2ecc71)
      .setTimestamp(new Date())
      .setFooter({ text: `ページ ${index + 1}/${totalPages}` });

    for (const item of pageItems) {
      embed.addFields({
        name: `${item.name} (${formatPrice(item.price)})`,
        value: item.description && item.description.length > 0 ? item.description : '説明はありません。'
      });
    }

    const components = [new ActionRowBuilder().addComponents(buildSelectMenu(pageItems))];
    await targetChannel.send({ embeds: [embed], components });
  }

  await interaction.reply({ content: 'ショップ情報を送信しました。', ephemeral: true });
}

async function handleAnnounceDelete(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'ギルド内でのみ利用できます。', ephemeral: true });
    return;
  }

  const targetChannel = interaction.options.getChannel('channel', true);
  if (!targetChannel.isTextBased()) {
    await interaction.reply({ content: 'テキストチャンネルを指定してください。', ephemeral: true });
    return;
  }

  const permissions = targetChannel.permissionsFor(interaction.client.user);
  if (!permissions?.has('ViewChannel') || !permissions?.has('ReadMessageHistory')) {
    await interaction.reply({ content: '指定チャンネルのメッセージ履歴を参照できません。権限を確認してください。', ephemeral: true });
    return;
  }

  const fetched = await targetChannel.messages.fetch({ limit: 100 });
  const candidates = fetched.filter((message) =>
    message.author?.id === interaction.client.user?.id &&
    message.embeds.some((embed) => embed?.title === 'ショップ一覧')
  );

  if (candidates.size === 0) {
    await interaction.reply({ content: '削除対象のショップ案内メッセージが見つかりませんでした。', ephemeral: true });
    return;
  }

  const sorted = Array.from(candidates.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const limited = sorted.slice(0, 24);

  const options = limited.map((message) => {
    const footer = message.embeds[0]?.footer?.text ?? 'ページ情報なし';
    const createdAt = message.createdAt ? message.createdAt.toLocaleString('ja-JP', { hour12: false }) : '日時不明';
    return {
      label: truncate(`${footer} (${createdAt})`, 100) ?? footer,
      description: `メッセージID: ${message.id}`,
      value: `${targetChannel.id}:${message.id}`
    };
  });

  const menu = buildSelectMenuWithDefault(
    SHOP_ANNOUNCE_DELETE_SELECT_ID,
    '削除するメッセージを選択してください',
    options
  );

  const note = sorted.length > limited.length
    ? '最新の24件のみ表示しています。必要に応じて再実行してください。'
    : null;

  await interaction.reply({
    content: [
      `チャンネル <#${targetChannel.id}> の削除するメッセージを選択してください。`,
      note
    ].filter(Boolean).join('\n'),
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true
  });
}

export async function handleShopSelect(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'ギルド内でのみ利用できます。', ephemeral: true });
    return;
  }

  try {
    const selectedId = interaction.values?.[0];
    if (!selectedId) {
      await interaction.reply({ content: '選択されたアイテムがありません。', ephemeral: true });
      return;
    }

    if (selectedId === SELECT_NOOP_VALUE) {
      await interaction.deferUpdate().catch(() => null);
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const item = await prisma.shopItem.findFirst({
      where: { id: selectedId, guildId }
    });

    if (!item) {
      await interaction.editReply({ content: '選択したアイテムが見つかりません。', components: [], embeds: [] });
      return;
    }

    const sessionId = createSession({
      guildId,
      userId: interaction.user.id,
      itemId: item.id
    });

    const confirmButton = new ButtonBuilder()
      .setCustomId(`${SHOP_CONFIRM_ID}:${sessionId}`)
      .setLabel('購入')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId(`${SHOP_CANCEL_ID}:${sessionId}`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary);

    const buttons = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
    const embed = buildItemEmbed(item).setFooter({ text: item.id });

    await interaction.editReply({
      content: `この購入セッションは <@${interaction.user.id}> のみが確定できます。セッションID: ${sessionId}`,
      embeds: [embed],
      components: [buttons]
    });
  } catch (error) {
    logger.error({ err: error, guildId, interactionId: interaction.id }, 'Failed to handle shop select');
    const response = { content: 'アイテム情報の取得に失敗しました。', components: [], embeds: [] };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response).catch(() => null);
    } else {
      await interaction.reply({ ...response, ephemeral: true }).catch(() => null);
    }
  }
}

export async function handleShopCancel(interaction, sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    await interaction.reply({ content: 'セッションの有効期限が切れています。', ephemeral: true });
    return;
  }

  if (session.userId !== interaction.user.id) {
    await interaction.reply({ content: 'このセッションを操作できるのは購入者のみです。', ephemeral: true });
    return;
  }

  clearSession(sessionId);
  await interaction.reply({ content: '購入をキャンセルしました。', ephemeral: true });
}

export async function handleShopConfirm(interaction, sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    await interaction.reply({ content: 'セッションの有効期限が切れています。', ephemeral: true });
    return;
  }

  if (session.userId !== interaction.user.id) {
    await interaction.reply({ content: 'このセッションを操作できるのは購入者のみです。', ephemeral: true });
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId || guildId !== session.guildId) {
    await interaction.reply({ content: 'ギルド情報が一致しません。', ephemeral: true });
    return;
  }

  try {
    const item = await prisma.shopItem.findFirst({
      where: { id: session.itemId, guildId }
    });

    if (!item) {
      clearSession(sessionId);
      await interaction.reply({ content: 'アイテムが見つかりませんでした。', ephemeral: true });
      return;
    }

    const purchase = await debit(guildId, interaction.user, item.price, {
      reason: `ショップ購入: ${item.name}`,
      metadata: {
        itemId: item.id,
        sessionId,
        interactionId: interaction.id
      }
    });

    if (item.roleId && interaction.guild) {
      let role = interaction.guild.roles.cache.get(item.roleId);
      if (!role) {
        try {
          role = await interaction.guild.roles.fetch(item.roleId);
        } catch (error) {
          logger.error({ err: error, guildId, roleId: item.roleId }, 'Failed to fetch role for shop purchase');
        }
      }

      if (role) {
        try {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
          }
        } catch (error) {
          logger.error({ err: error, guildId, roleId: item.roleId, userId: interaction.user.id }, 'Failed to assign role for shop purchase');
        }
      }
    }

    clearSession(sessionId);
    const remaining = purchase?.balance?.balance;
    const balanceText = Number.isFinite(remaining) ? ` 残高: ${formatPrice(remaining)}` : '';
    await interaction.reply({ content: `購入が完了しました！${balanceText}`, ephemeral: true });
  } catch (error) {
    if (error instanceof CurrencyError) {
      if (error.code === 'INSUFFICIENT_FUNDS') {
        await interaction.reply({ content: '所持金が不足しています。', ephemeral: true }).catch(() => null);
        return;
      }

      await interaction.reply({ content: `購入に失敗しました: ${error.message}`, ephemeral: true }).catch(() => null);
      return;
    }

    logger.error({ err: error, guildId, sessionId }, 'Failed to confirm shop purchase');
    await interaction.reply({ content: '購入処理中にエラーが発生しました。', ephemeral: true }).catch(() => null);
  }
}

export async function handleShopItemRemoveSelect(interaction) {
  const selectedId = interaction.values?.[0];
  if (!selectedId || selectedId === SELECT_NOOP_VALUE) {
    await interaction.deferUpdate().catch(() => null);
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'ギルド内でのみ利用できます。', ephemeral: true }).catch(() => null);
    return;
  }

  await interaction.deferUpdate().catch(() => null);

  try {
    const item = await prisma.shopItem.findFirst({
      where: { id: selectedId, guildId }
    });

    if (!item) {
      await interaction.editReply({ content: '選択したアイテムが見つかりません。', components: [] }).catch(() => null);
      return;
    }

    await prisma.shopItem.delete({ where: { id: selectedId } });

    await interaction.editReply({
      content: `アイテム「${item.name}」を削除しました。`,
      components: []
    }).catch(() => null);
  } catch (error) {
    logger.error({ err: error, guildId, itemId: selectedId }, 'Failed to remove shop item');
    await interaction.editReply({ content: 'アイテムの削除に失敗しました。', components: [] }).catch(() => null);
  }
}

export async function handleShopAnnounceDeleteSelect(interaction) {
  const selectedValue = interaction.values?.[0];
  if (!selectedValue || selectedValue === SELECT_NOOP_VALUE) {
    await interaction.deferUpdate().catch(() => null);
    return;
  }

  const [channelId, messageId] = selectedValue.split(':');
  if (!channelId || !messageId) {
    await interaction.deferUpdate().catch(() => null);
    await interaction.editReply({ content: 'メッセージ情報の解析に失敗しました。', components: [] }).catch(() => null);
    return;
  }

  await interaction.deferUpdate().catch(() => null);

  try {
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.guildId !== interaction.guildId) {
      await interaction.editReply({ content: '対象チャンネルにアクセスできません。', components: [] }).catch(() => null);
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.editReply({ content: 'メッセージが既に削除されています。', components: [] }).catch(() => null);
      return;
    }

    await message.delete();

    await interaction.editReply({ content: 'ショップ案内メッセージを削除しました。', components: [] }).catch(() => null);
  } catch (error) {
    logger.error({ err: error, guildId: interaction.guildId, channelId, messageId }, 'Failed to delete shop announcement');
    await interaction.editReply({ content: 'メッセージの削除に失敗しました。', components: [] }).catch(() => null);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('ギルド内ショップを管理します。')
    .setDMPermission(false)
    .addSubcommandGroup((group) =>
      group
        .setName('item')
        .setDescription('ショップアイテムを管理します。')
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('ショップにアイテムを追加します。')
            .addStringOption((option) =>
              option.setName('name').setDescription('アイテム名').setRequired(true)
            )
            .addIntegerOption((option) =>
              option.setName('price').setDescription('価格').setRequired(true).setMinValue(1)
            )
            .addStringOption((option) =>
              option.setName('description').setDescription('説明')
            )
            .addRoleOption((option) =>
              option.setName('role').setDescription('購入時に付与するロール')
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('ショップアイテムを削除します。')
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('announce')
        .setDescription('ショップ案内メッセージを管理します。')
        .addSubcommand((sub) =>
          sub
            .setName('send')
            .setDescription('ショップの一覧を案内します。')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('送信先チャンネル')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('ショップ案内メッセージを削除します。')
            .addChannelOption((option) =>
              option
                .setName('channel')
                .setDescription('対象チャンネル')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
        )
    ),
  async execute(client, interaction) {
    if (interaction.isChatInputCommand() && interaction.commandName === 'shop') {
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      if (subcommandGroup === 'item') {
        if (subcommand === 'add') {
          await handleItemAdd(interaction);
          return;
        }

        if (subcommand === 'remove') {
          await handleItemRemove(interaction);
          return;
        }
      }

      if (subcommandGroup === 'announce') {
        if (subcommand === 'send') {
          await handleAnnounceSend(interaction);
          return;
        }

        if (subcommand === 'delete') {
          await handleAnnounceDelete(interaction);
          return;
        }
      }

      await interaction.reply({ content: '不明なサブコマンドです。', ephemeral: true });
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === SHOP_SELECT_ID) {
        await handleShopSelect(interaction);
        return;
      }

      if (interaction.customId === SHOP_ITEM_REMOVE_SELECT_ID) {
        await handleShopItemRemoveSelect(interaction);
        return;
      }

      if (interaction.customId === SHOP_ANNOUNCE_DELETE_SELECT_ID) {
        await handleShopAnnounceDeleteSelect(interaction);
        return;
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith(`${SHOP_CANCEL_ID}:`)) {
        const [, sessionId] = interaction.customId.split(':');
        await handleShopCancel(interaction, sessionId);
        return;
      }

      if (interaction.customId.startsWith(`${SHOP_CONFIRM_ID}:`)) {
        const [, sessionId] = interaction.customId.split(':');
        await handleShopConfirm(interaction, sessionId);
        return;
      }
    }
  }
};