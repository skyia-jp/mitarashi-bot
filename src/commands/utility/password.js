import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { verifyPassword } from '../../services/passwordAuthService.js';
import logger from '../../utils/logger.js';

async function fetchRole(guild, roleId) {
  if (!roleId) {
    return null;
  }

  return guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
}

async function ensureBotCanAssignRole(guild, role) {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Botに「ロールの管理」権限が無いため、ロールを付与できません。');
  }

  if (role.position >= me.roles.highest.position) {
    throw new Error('設定されたロールがBotより上位にあるため付与できません。管理者にロールの位置を確認してください。');
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('password')
    .setDescription('パスワードを入力してロールを取得します')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('value')
        .setDescription('共有されたパスワードを入力してください')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(128)
    ),
  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const password = interaction.options.getString('value', true);

    const { success, config } = await verifyPassword(interaction.guildId, password);

    if (!config?.passwordAuthRoleId || !config.passwordAuthSecretHash) {
      await interaction.editReply({
        content: '現在、パスワード認証によるロール付与は設定されていません。管理者にお問い合わせください。'
      });
      return;
    }

    if (!success) {
      const hint = config.passwordAuthHint ? `\nヒント: ${config.passwordAuthHint}` : '';
      await interaction.editReply({ content: `パスワードが一致しませんでした。${hint}`.trim() });
      return;
    }

    const role = await fetchRole(interaction.guild, config.passwordAuthRoleId);

    if (!role) {
      await interaction.editReply({
        content: '設定されたロールが見つかりませんでした。管理者に確認を依頼してください。'
      });
      return;
    }

    try {
      await ensureBotCanAssignRole(interaction.guild, role);
    } catch (error) {
      await interaction.editReply({ content: error.message });
      return;
    }

    const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id));

    if (member.roles.cache.has(role.id)) {
      await interaction.editReply({ content: `既に ${role} が付与されています。` });
      return;
    }

    try {
      await member.roles.add(role, 'Password authenticated role assignment');
    } catch (error) {
      logger.error({ err: error, guildId: interaction.guildId, roleId: role.id }, 'Failed to assign password auth role');
      await interaction.editReply({
        content: 'ロールの付与に失敗しました。Botの権限やロールの位置を確認してください。'
      });
      return;
    }

    await interaction.editReply({ content: `${role} を付与しました。ようこそ！` });
  }
};
