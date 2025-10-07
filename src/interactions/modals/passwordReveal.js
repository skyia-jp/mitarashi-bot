import { getPasswordReveal } from '../../services/passwordRevealService.js';

const MODAL_BASE_ID = 'pwd_reveal_modal';

function resolveButtonCustomId(modalCustomId) {
  const [, identifier] = modalCustomId.split(':');
  return identifier ? `pwd_reveal:${identifier}` : modalCustomId.replace(MODAL_BASE_ID, 'pwd_reveal');
}

export default {
  customId: MODAL_BASE_ID,
  async execute(client, interaction) {
    const originalCustomId = resolveButtonCustomId(interaction.customId);
    const entry = await getPasswordReveal(originalCustomId);

    if (!entry) {
      await interaction.reply({
        content: 'パスワード情報の取得に失敗しました。管理者に再送信を依頼してください。',
        ephemeral: true
      });
      return;
    }

    const submittedValue = interaction.fields.getTextInputValue('password');
    const displayedPassword = submittedValue || entry.password;

    await interaction.reply({
      content: `パスワードは \`${displayedPassword}\` です。安全に取り扱ってください。` +
        (entry.description ? `\n\n> ${entry.description}` : ''),
      ephemeral: true
    });
  }
};
