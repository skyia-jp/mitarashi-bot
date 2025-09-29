import { SlashCommandBuilder } from 'discord.js';
import { addNote, getNotes, removeNote } from '../../services/noteService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

function formatNotes(notes) {
  if (!notes.length) return 'メモは登録されていません。';
  return notes
    .map((note) => `#${note.id} by ${note.author.username ?? note.author.discordId}: ${note.content}`)
    .join('\n');
}

export default {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('メモを管理します')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('メモを追加します')
        .addStringOption((option) =>
          option.setName('content').setDescription('メモ内容').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('メモ一覧を表示します')
        .addUserOption((option) =>
          option.setName('user').setDescription('特定ユーザーのメモのみ表示')
        )
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数 (最大50)').setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('メモを削除します')
        .addIntegerOption((option) =>
          option.setName('note_id').setDescription('削除するメモID').setRequired(true)
        )
    ),
  async execute(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const content = interaction.options.getString('content', true);
      await addNote(interaction, content);
      await interaction.reply({ content: '📝 メモを追加しました。', ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user');
      const limit = interaction.options.getInteger('limit') ?? 20;

      let authorId = null;
      if (user) {
        const author = await getOrCreateUser(user);
        authorId = author.id;
      }

      const notes = await getNotes(interaction.guildId, authorId, limit);
      await interaction.editReply({
        embeds: [
          {
            title: '📒 メモ一覧',
            description: formatNotes(notes),
            color: 0x1abc9c,
            timestamp: new Date().toISOString()
          }
        ]
      });
      return;
    }

    const noteId = interaction.options.getInteger('note_id', true);
    const result = await removeNote(interaction.guildId, noteId);
    if (result.count === 0) {
      await interaction.reply({ content: '指定したメモは見つかりませんでした。', ephemeral: true });
      return;
    }
    await interaction.reply({ content: '🗑️ メモを削除しました。', ephemeral: true });
  }
};
