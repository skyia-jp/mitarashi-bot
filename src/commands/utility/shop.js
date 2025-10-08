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

const SHOP_SELECT_ID = 'shop_select';
const SHOP_CONFIRM_ID = 'shop_confirm';
const SHOP_CANCEL_ID = 'shop_cancel';
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

async function handleAdd(interaction) {
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
      guild_id: guildId,
      name,
      description,
      price,
      role_id: role ? role.id : null,
      created_by: interaction.user.id
    }
  });

  await interaction.reply({ content: 'アイテムを追加しました。', ephemeral: true });
}

function buildSelectMenu(items) {
  return new StringSelectMenuBuilder()
    .setCustomId(SHOP_SELECT_ID)
    .setPlaceholder('購入するアイテムを選択してください')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      items.map((item) => ({
        label: truncate(item.name, 100) ?? item.name,
        description: truncate(item.description ?? '説明はありません。', 100),
        value: item.id
      }))
    );
}

async function handleAnnounce(interaction) {
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
    where: { guild_id: guildId },
    orderBy: [{ name: 'asc' }, { price: 'asc' }]
  });

  if (items.length === 0) {
    await interaction.reply({ content: '登録されているアイテムがありません。', ephemeral: true });
    return;
  }

  const pages = chunk(items, 25);
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

async function handleSelect(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'ギルド内でのみ利用できます。', ephemeral: true });
    return;
  }

  const selectedId = interaction.values[0];

  await interaction.deferReply({ ephemeral: true });

  const item = await prisma.shopItem.findFirst({
    where: { id: selectedId, guild_id: guildId }
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
}

async function handleCancel(interaction, sessionId) {
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

async function handleConfirm(interaction, sessionId) {
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
      where: { id: session.itemId, guild_id: guildId }
    });

    if (!item) {
      clearSession(sessionId);
      await interaction.reply({ content: 'アイテムが見つかりませんでした。', ephemeral: true });
      return;
    }

    const currency = await prisma.userCurrency.findFirst({
      where: {
        guild_id: guildId,
        user_id: interaction.user.id
      }
    });

    if (!currency || currency.balance < item.price) {
      await interaction.reply({ content: '所持金が不足しています。', ephemeral: true });
      return;
    }

    await prisma.userCurrency.update({
      where: { id: currency.id },
      data: { balance: currency.balance - item.price }
    });

    if (item.role_id && interaction.guild) {
      let role = interaction.guild.roles.cache.get(item.role_id);
      if (!role) {
        try {
          role = await interaction.guild.roles.fetch(item.role_id);
        } catch (error) {
          logger.error({ err: error, guildId, roleId: item.role_id }, 'Failed to fetch role for shop purchase');
        }
      }

      if (role) {
        try {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
          }
        } catch (error) {
          logger.error({ err: error, guildId, roleId: item.role_id, userId: interaction.user.id }, 'Failed to assign role for shop purchase');
        }
      }
    }

    clearSession(sessionId);
    await interaction.reply({ content: '購入が完了しました！', ephemeral: true });
  } catch (error) {
    logger.error({ err: error, guildId, sessionId }, 'Failed to confirm shop purchase');
    await interaction.reply({ content: '購入処理中にエラーが発生しました。', ephemeral: true });
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('ギルド内ショップを管理します。')
    .setDMPermission(false)
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
        .setName('announce')
        .setDescription('ショップの一覧を案内します。')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('送信先チャンネル')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    ),
  async execute(client, interaction) {
    if (interaction.isChatInputCommand() && interaction.commandName === 'shop') {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'add') {
        await handleAdd(interaction);
        return;
      }

      if (subcommand === 'announce') {
        await handleAnnounce(interaction);
        return;
      }

      await interaction.reply({ content: '不明なサブコマンドです。', ephemeral: true });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === SHOP_SELECT_ID) {
      await handleSelect(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith(`${SHOP_CANCEL_ID}:`)) {
        const [, sessionId] = interaction.customId.split(':');
        await handleCancel(interaction, sessionId);
        return;
      }

      if (interaction.customId.startsWith(`${SHOP_CONFIRM_ID}:`)) {
        const [, sessionId] = interaction.customId.split(':');
        await handleConfirm(interaction, sessionId);
        return;
      }
    }
  }
};