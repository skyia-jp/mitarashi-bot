import { SlashCommandBuilder } from 'discord.js';
import { registerReminder, cancelReminder } from '../../services/reminderService.js';
import { listRemindersByUser } from '../../database/repositories/reminderRepository.js';
import { DEFAULT_TIMEZONE } from '../../config/constants.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('リマインダーを管理します')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('新しいリマインダーを作成します')
        .addStringOption((option) =>
          option
            .setName('cron')
            .setDescription('cron 表記のスケジュール (例: 0 9 * * 1)')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('リマインダー内容')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('タイムゾーン (例: Asia/Tokyo)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('リマインダーを削除します')
        .addIntegerOption((option) =>
          option.setName('id').setDescription('リマインダーID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('自分のリマインダー一覧を表示します')
    ),
  async execute(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const cron = interaction.options.getString('cron', true);
      const message = interaction.options.getString('message', true);
      const timezone = interaction.options.getString('timezone') || DEFAULT_TIMEZONE;

      try {
        const reminder = await registerReminder(client, interaction.user, {
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          message,
          cronExpression: cron,
          timezone
        });

        await interaction.reply({
          content: `⏰ リマインダーを登録しました。ID: ${reminder.id}`,
          ephemeral: true
        });
      } catch (error) {
        await interaction.reply({
          content: `cron 表記が正しいか確認してください。詳細: ${error.message}`,
          ephemeral: true
        });
      }
      return;
    }

    if (subcommand === 'cancel') {
      const id = interaction.options.getInteger('id', true);
      try {
        await cancelReminder(id);
        await interaction.reply({ content: `🗑️ リマインダー ID ${id} を削除しました。`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: 'リマインダーの削除に失敗しました。', ephemeral: true });
      }
      return;
    }

    if (subcommand === 'list') {
      const reminders = await listRemindersByUser(interaction.guildId, interaction.user.id);
      if (!reminders.length) {
        await interaction.reply({ content: '登録済みのリマインダーはありません。', ephemeral: true });
        return;
      }

      const description = reminders
        .map((reminder) => `ID: ${reminder.id} - ${reminder.message} (cron: ${reminder.cronExpression})`)
        .join('\n');

      await interaction.reply({
        embeds: [
          {
            title: '⏰ リマインダー一覧',
            description,
            color: 0x00bcd4
          }
        ],
        ephemeral: true
      });
    }
  }
};
