import type { Client, ModalSubmitInteraction } from 'discord.js';
import { handlePasswordSubmission } from '../../services/passwordGrantService.js';

const MODAL_CUSTOM_ID = 'pwd_reveal_modal';

export default {
  customId: MODAL_CUSTOM_ID,
  async execute(client: Client, interaction: ModalSubmitInteraction) {
    const submittedValue = interaction.fields.getTextInputValue('password')?.trim();

    if (!submittedValue) {
      await interaction.reply({ content: 'パスワードを入力してください。', ephemeral: true });
      return;
    }

    const member = interaction.member ?? (await interaction.guild?.members.fetch(interaction.user.id));
    const result = await handlePasswordSubmission(
      interaction.guild as import('discord.js').Guild,
      member as import('discord.js').GuildMember,
      submittedValue
    );

    await interaction.reply({ content: result.message, ephemeral: true });
  }
};
