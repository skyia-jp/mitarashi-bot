import { buildInteractionLogger } from '../../utils/logger.js';
import { recordSlashCommandOutcome } from '../../utils/interactionAudit.js';

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
        missingLogger.warn({ event: 'interaction.command.missing' }, 'Received unknown slash command');
        await recordSlashCommandOutcome(interaction, {
          status: 'warning',
          durationMs: 0,
          subcommand_group: null,
          subcommand: null,
          error: 'Missing slash command handler'
        });
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
  commandLogger.info({ event: 'interaction.command.start' }, 'Handling slash command');

      try {
        await command.execute(client, interaction);
        const successDurationMs = Date.now() - startedAt;
        commandLogger.info(
          {
            event: 'interaction.command.success',
            duration_ms: successDurationMs
          },
          'Slash command executed successfully'
        );
        await recordSlashCommandOutcome(interaction, {
          status: 'success',
          durationMs: successDurationMs,
          subcommandGroup,
          subcommand
        });
      } catch (error) {
        const failureDurationMs = Date.now() - startedAt;
        commandLogger.error(
          {
            err: error,
            event: 'interaction.command.error',
            duration_ms: failureDurationMs
          },
          'Slash command execution failed'
        );
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: 'コマンド実行中にエラーが発生しました。' });
        } else {
          await interaction.reply({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
        }
        await recordSlashCommandOutcome(interaction, {
          status: 'failure',
          durationMs: failureDurationMs,
          subcommandGroup,
          subcommand,
          error
        });
      }
      return;
    }

    if (interaction.isStringSelectMenu() || interaction.isButton() || interaction.isModalSubmit()) {
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
        missingLogger.warn({ event: 'interaction.component.missing' }, 'Received component interaction without handler');
        return;
      }

      const componentLogger = buildInteractionLogger(interaction, {
        component: interaction.customId,
        handler_key: handler.customId ?? dynamicKey
      });

      const startedAt = Date.now();
  componentLogger.info({ event: 'interaction.component.start' }, 'Handling component interaction');

      try {
        await handler.execute(client, interaction);
        const successDurationMs = Date.now() - startedAt;
        componentLogger.info(
          {
            event: 'interaction.component.success',
            duration_ms: successDurationMs
          },
          'Component interaction handled successfully'
        );
      } catch (error) {
        const failureDurationMs = Date.now() - startedAt;
        componentLogger.error(
          {
            err: error,
            event: 'interaction.component.error',
            duration_ms: failureDurationMs
          },
          'Component interaction failed'
        );
      }
    }
  }
};
