import { buildInteractionLogger } from '../../utils/logger.js';
import { recordSlashCommandOutcome } from '../../utils/interactionAudit.js';
import type { Client, Interaction, SelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction, ChatInputCommandInteraction } from 'discord.js';

export default {
  name: 'interactionCreate',
  async execute(client: Client, interaction: Interaction) {
    if (interaction.isChatInputCommand?.()) {
      const cmd = interaction as ChatInputCommandInteraction;
      const command = client.commands?.get(cmd.commandName);
      
      if (!command) {
        const missingLogger = buildInteractionLogger(cmd, { command: cmd.commandName }, { reason: 'missing_command' });
        missingLogger.warn({ event: 'interaction.command.missing' }, 'Received unknown slash command');
        recordSlashCommandOutcome(cmd, {
          status: 'warning',
          durationMs: 0,
          subcommand_group: null,
          subcommand: null,
          error: 'Missing slash command handler'
        }).catch(() => {});
        return;
      }

      const subcommandGroup = cmd.options.getSubcommandGroup(false) ?? null;
      const subcommand = cmd.options.getSubcommand(false) ?? null;
      const commandLogger = buildInteractionLogger(cmd, {
        command: cmd.commandName,
        subcommand_group: subcommandGroup,
        subcommand
      });

      const startedAt = Date.now();

      try {
        await command.execute(client, cmd);
        const successDurationMs = Date.now() - startedAt;
        commandLogger.info(
          {
            event: 'interaction.command.success',
            duration_ms: successDurationMs
          },
          'Slash command executed successfully'
        );
        recordSlashCommandOutcome(cmd, {
          status: 'success',
          durationMs: successDurationMs,
          subcommandGroup,
          subcommand
        }).catch(() => {});
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
        if (cmd.deferred || cmd.replied) {
          await cmd.editReply({ content: 'コマンド実行中にエラーが発生しました。' });
        } else {
          await cmd.reply({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
        }
        recordSlashCommandOutcome(cmd, {
          status: 'failure',
          durationMs: failureDurationMs,
          subcommandGroup,
          subcommand,
          error
        }).catch(() => {});
      }
      return;
    }

    // component interactions
    if (
      (interaction as SelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction).isStringSelectMenu?.() ||
      (interaction as SelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction).isButton?.() ||
      (interaction as SelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction).isModalSubmit?.()
    ) {
      const comp = interaction as SelectMenuInteraction | ButtonInteraction | ModalSubmitInteraction;
      let handler = client.componentHandlers?.get(comp.customId);

      let dynamicKey: string | undefined;
      if (!handler && comp.customId.includes(':')) {
        dynamicKey = comp.customId.split(':')[0];
        handler = client.componentHandlers?.get(dynamicKey);
      }

      if (!handler) {
        const missingLogger = buildInteractionLogger(
          comp,
          { component: comp.customId },
          { reason: 'missing_component', dynamicKey }
        );
        missingLogger.warn({ event: 'interaction.component.missing' }, 'Received component interaction without handler');
        return;
      }

      const componentLogger = buildInteractionLogger(comp, {
        component: comp.customId,
        handler_key: (handler.customId ?? dynamicKey)
      });

      const startedAt = Date.now();

      try {
        await handler.execute(client, comp);
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
