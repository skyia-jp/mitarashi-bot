import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import {
  buildPasswordAuthStatus,
  clearPasswordAuthConfig,
  getPasswordAuthConfig,
  setPasswordAuthConfig
} from '../../services/passwordAuthService.js';

function buildStatusEmbed(config, guild) {
  const status = buildPasswordAuthStatus(config);

  if (!status.configured) {
    return {
      title: '🔐 パスワード認証設定',
      description: 'パスワードによるロール付与はまだ設定されていません。',
      color: 0x95a5a6,
      fields: status.updatedAt
        ? [
            {
              name: '最終更新',
              value: `<t:${Math.floor(status.updatedAt.getTime() / 1000)}:f>`
            }
          ]
        : []
    };
  }

  const role = guild.roles.cache.get(status.roleId);

  return {
    title: '🔐 パスワード認証設定',
    color: 0x3498db,
    fields: [
      {
        name: '付与ロール',
        value: role ? role.toString() : `ロールが見つかりません (ID: ${status.roleId})`
      },
      {
        name: 'ヒント',
        value: status.hint ?? '設定なし'
      },
      {
        name: '最終更新',
        value: status.updatedAt ? `<t:${Math.floor(status.updatedAt.getTime() / 1000)}:f>` : '記録なし'
      }
    ]
  };
}

async function ensureRoleIsAssignable(interaction, role) {
  if (!role) {
    throw new Error('ロールが見つかりません。');
  }

  if (role.managed) {
    throw new Error('連携サービス管理ロールには付与できません。別のロールを選択してください。');
  }

  const me = interaction.guild.members.me ?? (await interaction.guild.members.fetch(interaction.client.user.id));

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Botに「ロールの管理」権限がありません。');
  }

  if (role.position >= me.roles.highest.position) {
    throw new Error('Botより上位または同列のロールは付与できません。ロールの位置を調整してください。');
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('password-auth')
    .setDescription('パスワード認証によるロール付与を管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('パスワードと付与ロールを設定します')
        .addStringOption((option) =>
          option
            .setName('password')
            .setDescription('参加者に共有するパスワード')
            .setRequired(true)
            .setMinLength(4)
            .setMaxLength(128)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('正しいパスワードを入力したユーザーに付与するロール')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('hint')
            .setDescription('パスワード入力に失敗した場合に表示するヒント (任意)')
            .setMaxLength(150)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('clear').setDescription('パスワード認証によるロール付与設定を解除します')
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('現在の設定を表示します')),
  async execute(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: true });

    if (subcommand === 'status') {
      const config = await getPasswordAuthConfig(interaction.guildId);
      const embed = buildStatusEmbed(config, interaction.guild);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'clear') {
      await clearPasswordAuthConfig(interaction.guildId);
      await interaction.editReply({ content: 'パスワード認証設定を解除しました。' });
      return;
    }

    if (subcommand === 'set') {
      const password = interaction.options.getString('password', true);
      const role = interaction.options.getRole('role', true);
      const hint = interaction.options.getString('hint');

      try {
        await ensureRoleIsAssignable(interaction, role);
      } catch (error) {
        await interaction.editReply({ content: `設定に失敗しました: ${error.message}` });
        return;
      }

      try {
        await setPasswordAuthConfig(interaction.guildId, {
          password,
          roleId: role.id,
          hint
        });
      } catch (error) {
        await interaction.editReply({ content: `設定に失敗しました: ${error.message}` });
        return;
      }

      await interaction.editReply({
        content: `パスワード認証を設定しました。正しいパスワードを入力したユーザーに ${role} を付与します。`
      });
    }
  }
};
