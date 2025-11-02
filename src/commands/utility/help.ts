import { SlashCommandBuilder, Client, Collection, ChatInputCommandInteraction } from 'discord.js';

const ADMIN_COMMANDS = new Set(['job', 'role-menu', 'server', 'set-log-channel']);
const MODERATION_COMMANDS = new Set(['ban', 'kick', 'mute', 'warn', 'warn-reset']);
const CASINO_COMMANDS = new Set(['blackjack', 'poker', 'chinchiro']);

const CATEGORY_DEFINITIONS = [
  {
    key: 'admin',
    title: '🛠️ 管理',
    hint: 'サーバー設定やロール管理など、管理者向けのコマンドです。'
  },
  {
    key: 'moderation',
    title: '🛡️ モデレーション',
    hint: '警告・BAN などのモデレーション用コマンドです。'
  },
  {
    key: 'casino',
    title: '🎰 カジノ',
    hint: 'Lumacoin を賭けるカジノゲームや娯楽向けのコマンドです。'
  },
  {
    key: 'utility',
    title: '🧰 ユーティリティ',
    hint: '日常利用向けの便利コマンドです。'
  }
];

const OPTION_TYPE_LABELS = {
  1: 'サブコマンド',
  2: 'サブコマンドグループ',
  3: '文字列',
  4: '整数',
  5: '真偽値',
  6: 'ユーザー',
  7: 'チャンネル',
  8: 'ロール',
  9: 'メンション可能',
  10: '数値',
  11: '添付ファイル'
};

function resolveCategoryKey(commandName: string) {
  if (ADMIN_COMMANDS.has(commandName)) return 'admin';
  if (MODERATION_COMMANDS.has(commandName)) return 'moderation';
  if (CASINO_COMMANDS.has(commandName)) return 'casino';
  return 'utility';
}
function createCategoryBuckets() {
  return CATEGORY_DEFINITIONS.map((category) => ({
    ...category,
    commands: []
  }));
}

function groupCommands(client: Client & { commands: Collection<string, any> }) {
  const buckets = createCategoryBuckets();
  const lookup = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const command of client.commands.values()) {
    const key = resolveCategoryKey(command.data.name);
    const bucket = lookup.get(key) ?? lookup.get('utility');
    bucket.commands.push(command);
  }

  for (const bucket of buckets) {
    bucket.commands.sort((a: any, b: any) => a.data.name.localeCompare(b.data.name));
  }

  return buckets.filter((bucket) => bucket.commands.length > 0);
}

function buildOverviewEmbed(client: Client & { commands: Collection<string, any> }) {
  const groups = groupCommands(client);

  const fields = groups.map((group: any) => {
    const lines = group.commands.map((command: any) => `• \`/${command.data.name}\` — ${command.data.description}`);
    const value = [group.hint, '', ...lines].join('\n').trim();
    return {
      name: group.title,
      value: value.slice(0, 1024)
    };
  });

  return {
    title: 'ℹ️ コマンド一覧',
    description: 'カテゴリごとの代表的なスラッシュコマンドです。`/help command:<名前>` で個別の詳細も確認できます。',
    color: 0x3498db,
    fields,
    footer: {
      text: 'Tip: 入力途中で Tab を押すとコマンド補完が使えます。'
    },
    timestamp: new Date().toISOString()
  };
}

function formatOptionTree(options: any, depth = 0) {
  if (!options || options.length === 0) return null;

  const indent = '  '.repeat(depth);
  const lines: any[] = [];

  for (const option of options) {
    const typeLabel = OPTION_TYPE_LABELS[option.type] ?? `タイプ${option.type}`;
    const requiredLabel = option.required ? '必須' : '任意';
    lines.push(
      `${indent}• ${option.name} (${typeLabel} / ${requiredLabel}) — ${option.description ?? '説明がありません'}`
    );

    const child = formatOptionTree(option.options, depth + 1);
    if (child) {
      lines.push(child);
    }
  }

  return lines.join('\n');
}

function buildCommandDetailEmbed(command: any) {
  const json = command.data.toJSON();
  const optionTree = formatOptionTree(json.options ?? []);

  const fields: any[] = [];
  if (optionTree) {
    fields.push({
      name: 'オプション / サブコマンド',
      value: optionTree.slice(0, 1024)
    });
  }

  if (json.default_member_permissions) {
    fields.push({
      name: '必要権限',
      value: `\`${json.default_member_permissions}\``
    });
  }

  if (json.dm_permission === false) {
    fields.push({
      name: 'DMでの利用',
      value: 'DMでは使用できません'
    });
  }

  return {
    title: `/${command.data.name} の使い方`,
    description: command.data.description,
    color: 0x2ecc71,
    fields,
    footer: {
      text: '例: /help command:poker'
    },
    timestamp: new Date().toISOString()
  };
}

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('利用可能なコマンド一覧や詳細を表示します')
    .addStringOption((option) =>
      option
        .setName('command')
        .setDescription('詳細を確認したいコマンド名（例: ping）')
    ),
  async execute(client: Client & { commands: Collection<string, any> }, interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

  const target = interaction.options.getString('command');

    if (target) {
      const command = client.commands.get(target);
      if (!command) {
        await interaction.editReply({
          content: `⚠️ \`/${target}\` は見つかりませんでした。もう一度確認してください。`
        });
        return;
      }

      const embed = buildCommandDetailEmbed(command);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = buildOverviewEmbed(client);
    await interaction.editReply({ embeds: [embed] });
  }
};
