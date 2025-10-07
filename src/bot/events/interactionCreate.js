import { createLogger } from '../../utils/logger.js';

function buildInteractionLogger(interaction, overrides = {}, meta = {}) {
  const base = {
    module: 'interaction',
    trace_id: interaction.id,
    interaction_id: interaction.id,
    interaction_kind: interaction.isChatInputCommand()
      ? 'chat_input'
      : interaction.isButton()
      ? 'button'
      : interaction.isStringSelectMenu()
      ? 'string_select'
      : interaction.type,
    user_id: interaction.user?.id,
    guild_id: interaction.guildId ?? 'dm',
    channel_id: interaction.channelId ?? 'dm',
    locale: interaction.locale,
    ...overrides
  };

  return createLogger(base, {
    userTag: interaction.user?.tag,
    ...meta
  });
}

export default {
  name: 'interactionCreate',
  async execute(client, interaction) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        const missingLogger = buildInteractionLogger(
          interaction,
          { command: interaction.commandName },
          { reason: 'missing_command' }
        );
        missingLogger.warn('Received unknown slash command');
        return;
      }

      const subcommandGroup = interaction.options.getSubcommandGroup(false) ?? null;
      const subcommand = interaction.options.getSubcommand(false) ?? null;
      const commandLogger = buildInteractionLogger(interaction, {
        command: interaction.commandName,
        subcommand_group: subcommandGroup,
        subcommand
      });

      const startedAt = Date.now();
      commandLogger.info('Handling slash command');

      try {
        await command.execute(client, interaction);
        const successDurationMs = Date.now() - startedAt;
        commandLogger.info({ durationMs: successDurationMs }, 'Slash command executed successfully');
      } catch (error) {
        const failureDurationMs = Date.now() - startedAt;
        commandLogger.error({ err: error, durationMs: failureDurationMs }, 'Slash command execution failed');
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

      let dynamicKey;
      if (!handler && interaction.customId.includes(':')) {
        dynamicKey = interaction.customId.split(':')[0];
        handler = client.componentHandlers.get(dynamicKey);
      }

      if (!handler) {
        const missingLogger = buildInteractionLogger(
          interaction,
          { component: interaction.customId },
          { reason: 'missing_component', dynamicKey }
        );
        missingLogger.warn('Received component interaction without handler');
        return;
      }

      const componentLogger = buildInteractionLogger(interaction, {
        component: interaction.customId,
        handler_key: handler.customId ?? dynamicKey
      });

      const startedAt = Date.now();
      componentLogger.info('Handling component interaction');

      try {
        await handler.execute(client, interaction);
        const successDurationMs = Date.now() - startedAt;
        componentLogger.info({ durationMs: successDurationMs }, 'Component interaction handled successfully');
      } catch (error) {
        const failureDurationMs = Date.now() - startedAt;
        componentLogger.error({ err: error, durationMs: failureDurationMs }, 'Component interaction failed');
      }
    }
  }
};
