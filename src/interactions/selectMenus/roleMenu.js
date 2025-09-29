import { getMenuByMessage } from '../../services/roleMenuService.js';
import logger from '../../utils/logger.js';

export default {
  customId: 'role-menu',
  async execute(client, interaction) {
    const menuRecord = await getMenuByMessage(interaction.guildId, interaction.message.id);
    if (!menuRecord) {
      await interaction.reply({ content: 'このロールメニューは登録されていません。', ephemeral: true });
      return;
    }

    const selectedRoleIds = new Set(interaction.values);
    const optionRoleIds = menuRecord.options.map((option) => option.roleId);
    const member = await interaction.guild.members.fetch(interaction.user.id);

    const toAdd = optionRoleIds.filter((roleId) => selectedRoleIds.has(roleId) && !member.roles.cache.has(roleId));
    const toRemove = optionRoleIds.filter((roleId) => !selectedRoleIds.has(roleId) && member.roles.cache.has(roleId));

    try {
      if (toAdd.length) {
        await member.roles.add(toAdd);
      }
      if (toRemove.length) {
        await member.roles.remove(toRemove);
      }
      await interaction.reply({
        content: 'ロールを更新しました。',
        ephemeral: true
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to update roles via menu');
      await interaction.reply({ content: 'ロールの更新に失敗しました。権限を確認してください。', ephemeral: true });
    }
  }
};
