import {
  ActionRowBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  createMenu,
  attachMessageId,
  getMenu,
  listMenus,
  removeMenu
} from '../../services/roleMenuService.js';

const selectMenuCustomId = 'role-menu';

function collectRoleOption(interaction, index) {
  const roleOption = interaction.options.getRole(`role${index}`);
  if (!roleOption) return null;

  const label = interaction.options.getString(`label${index}`) || roleOption.name;
  const description = interaction.options.getString(`description${index}`) || undefined;
  const emoji = interaction.options.getString(`emoji${index}`) || undefined;

  return {
    role: roleOption,
    label,
    description,
    emoji
  };
}

function buildOptionFields(builder) {
  for (let i = 1; i <= 5; i += 1) {
    builder
      .addRoleOption((option) =>
        option
          .setName(`role${i}`)
          .setDescription(`${i}番目のロール`)
          .setRequired(i === 1)
      )
      .addStringOption((option) =>
        option.setName(`label${i}`).setDescription(`${i}番目のロールに表示するラベル`).setRequired(false)
      )
      .addStringOption((option) =>
        option.setName(`description${i}`).setDescription(`${i}番目の説明`).setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName(`emoji${i}`)
          .setDescription(`${i}番目のEmoji (例: 😀 または :emoji:)`)
          .setRequired(false)
      );
  }
}

export default {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName('rolemenu')
      .setDescription('ロールセレクターメニューを管理します')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sub) => {
        let subBuilder = sub
          .setName('create')
          .setDescription('ロールメニューを作成します')
          .addStringOption((option) =>
            option.setName('title').setDescription('メニュータイトル').setRequired(true)
          );
        buildOptionFields(subBuilder);
        subBuilder = subBuilder
          .addStringOption((option) =>
            option.setName('description').setDescription('メニュー説明').setRequired(false)
          )
          .addIntegerOption((option) =>
            option
              .setName('max')
              .setDescription('同時に選択できるロール数 (1-5)')
              .setMinValue(1)
              .setMaxValue(5)
              .setRequired(false)
          );
        return subBuilder;
      })
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('ロールメニューを削除します')
          .addIntegerOption((option) =>
            option.setName('menu_id').setDescription('削除するメニューID').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('ロールメニュ一覧を表示します')
      );
    return builder;
  })(),
  async execute(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      await interaction.deferReply({ ephemeral: true });

      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description') || undefined;
      const maxSelectable = interaction.options.getInteger('max') ?? 1;

      const options = [];
      for (let i = 1; i <= 5; i += 1) {
        const option = collectRoleOption(interaction, i);
        if (option) options.push(option);
      }

      const menuRecord = await createMenu(interaction, {
        channelId: interaction.channelId,
        title,
        description,
        maxSelectable,
        options: options.map((opt) => ({
          roleId: opt.role.id,
          label: opt.label,
          description: opt.description,
          emoji: opt.emoji
        }))
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(selectMenuCustomId)
        .setMinValues(0)
        .setMaxValues(Math.min(maxSelectable, options.length))
        .setPlaceholder(title)
        .addOptions(
          options.map((opt) => ({
            label: opt.label,
            description: opt.description,
            value: opt.role.id,
            emoji: opt.emoji || undefined
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);
      const message = await interaction.channel.send({
        embeds: [
          {
            title,
            description,
            color: 0x5865f2,
            footer: { text: `Menu ID: ${menuRecord.id}` }
          }
        ],
        components: [row]
      });

      await attachMessageId(menuRecord.id, message.id);
      await interaction.editReply({ content: `✅ ロールメニューを作成しました。Menu ID: ${menuRecord.id}` });
      return;
    }

    if (subcommand === 'remove') {
      const menuId = interaction.options.getInteger('menu_id', true);
      const targetMenu = await getMenu(menuId);
      if (!targetMenu || targetMenu.guildId !== interaction.guildId) {
        await interaction.reply({ content: '指定したメニューが見つかりません。', ephemeral: true });
        return;
      }

      if (targetMenu.messageId) {
        const channel = await interaction.guild.channels.fetch(targetMenu.channelId).catch(() => null);
        if (channel?.isTextBased()) {
          await channel.messages.delete(targetMenu.messageId).catch(() => null);
        }
      }

      await removeMenu(menuId);
      await interaction.reply({ content: `🗑️ メニュー ID ${menuId} を削除しました。`, ephemeral: true });
      return;
    }

    const menus = await listMenus(interaction.guildId);
    if (!menus.length) {
      await interaction.reply({ content: 'メニューは登録されていません。', ephemeral: true });
      return;
    }

    const description = menus
      .map((menu) => `ID: ${menu.id} | チャンネル: <#${menu.channelId}> | メッセージ: ${menu.messageId ?? '未送信'}`)
      .join('\n');

    await interaction.reply({
      embeds: [
        {
          title: '🎭 ロールメニュー一覧',
          description,
          color: 0x5865f2
        }
      ],
      ephemeral: true
    });
  }
};
