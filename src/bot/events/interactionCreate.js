import logger from '../../utils/logger.js';

export default {
  name: 'interactionCreate',
  async execute(client, interaction) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(client, interaction);
      } catch (error) {
        logger.error({ err: error, command: interaction.commandName }, 'Command execution failed');
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: 'コマンド実行中にエラーが発生しました。' });
        } else {
          await interaction.reply({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
        }
      }
      return;
    }

    if (interaction.isStringSelectMenu() || interaction.isButton()) {
      let handler = client.componentHandlers.get(interaction.customId);

      if (!handler && interaction.customId.includes(':')) {
        const dynamicKey = interaction.customId.split(':')[0];
        handler = client.componentHandlers.get(dynamicKey);
      }

      if (!handler) return;
      try {
        await handler.execute(client, interaction);
      } catch (error) {
        logger.error({ err: error, customId: interaction.customId }, 'Component interaction failed');
      }
    }
  }
};
