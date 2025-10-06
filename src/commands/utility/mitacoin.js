import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { OWNER_IDS } from '../../config/constants.js';
import {
  CurrencyError,
  claimDaily,
  credit,
  debit,
  getBalance,
  transfer,
  TRANSACTION_TYPES
} from '../../services/currencyService.js';

const intl = new Intl.NumberFormat('ja-JP');

function formatCoins(amount) {
  return `${intl.format(amount)} MITACoin`;
}

function isOwnerOrAdmin(interaction) {
  if (OWNER_IDS.includes(interaction.user.id)) {
    return true;
  }
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

function buildBalanceEmbed(targetUser, balance) {
  return {
    title: '💰 MITACoin 残高',
    description: `${targetUser} の所持金は **${formatCoins(balance.balance)}** です。`,
    color: 0x3498db,
    footer: { text: `最終更新: ${balance.updatedAt.toLocaleString?.() ?? ''}` }
  };
}

async function handleCurrencyError(interaction, error) {
  if (error instanceof CurrencyError) {
    if (error.code === 'COOLDOWN_ACTIVE' && error.context?.retryAt) {
      const retryTime = error.context.retryAt instanceof Date
        ? error.context.retryAt
        : new Date(error.context.retryAt);
      await interaction.editReply({
        content: `⏳ デイリーボーナスはまだ受け取れません。次回は <t:${Math.floor(retryTime.getTime() / 1000)}:R> に受け取れます。`
      });
      return;
    }

    if (error.code === 'INSUFFICIENT_FUNDS') {
      await interaction.editReply({
        content: `💸 残高が不足しています。（現在: ${formatCoins(error.context.current ?? 0)}, 必要: ${formatCoins(error.context.required ?? 0)})`
      });
      return;
    }

    await interaction.editReply({
      content: `⚠️ エラー: ${error.message}`
    });
    return;
  }

  throw error;
}

export default {
  data: new SlashCommandBuilder()
    .setName('mitacoin')
    .setDescription('MITACoin の残高確認や送金、受け取りを行います。')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('balance')
        .setDescription('MITACoin 残高を確認します。')
        .addUserOption((option) =>
          option.setName('user').setDescription('確認するユーザー（省略時は自分）')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription('他のユーザーに MITACoin を送ります。')
        .addUserOption((option) =>
          option.setName('user').setDescription('送金先').setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('送金額')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('送金理由（任意）')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('管理者として MITACoin を付与します。')
        .addUserOption((option) => option.setName('user').setDescription('付与対象').setRequired(true))
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('付与額')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption((option) => option.setName('reason').setDescription('付与理由（任意）'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('pay')
        .setDescription('自身の MITACoin を消費します。')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('消費額')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption((option) => option.setName('reason').setDescription('用途（任意）'))
    )
    .addSubcommand((sub) =>
      sub.setName('daily').setDescription('デイリーボーナスを受け取ります。')
    ),
  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'balance': {
          const target = interaction.options.getUser('user') ?? interaction.user;
          const { balance } = await getBalance(target);
          const embed = buildBalanceEmbed(target, balance);
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'daily': {
          const { reward, balance, nextClaimAt } = await claimDaily(interaction.user);
          await interaction.editReply({
            content: `🎁 デイリーボーナスとして **${formatCoins(reward)}** を受け取りました！次回は <t:${Math.floor(nextClaimAt.getTime() / 1000)}:R> に受け取れます。現在の残高: ${formatCoins(balance.balance)}`
          });
          break;
        }
        case 'give': {
          const targetUser = interaction.options.getUser('user', true);
          const amount = interaction.options.getInteger('amount', true);
          const reason = interaction.options.getString('reason') ?? undefined;

          const result = await transfer(interaction.user, targetUser, amount, {
            reason,
            metadata: { method: 'command' }
          });

          await interaction.editReply({
            content: `🤝 ${targetUser} に **${formatCoins(amount)}** を送金しました。あなたの残高: ${formatCoins(result.sender.balance.balance)} / 相手の残高: ${formatCoins(result.recipient.balance.balance)}`
          });
          break;
        }
        case 'add': {
          if (!isOwnerOrAdmin(interaction)) {
            await interaction.editReply({ content: 'この操作を行う権限がありません。' });
            return;
          }

          const targetUser = interaction.options.getUser('user', true);
          const amount = interaction.options.getInteger('amount', true);
          const reason = interaction.options.getString('reason') ?? '管理者付与';

          const { balance } = await credit(targetUser, amount, {
            type: TRANSACTION_TYPES.ADJUST,
            reason,
            metadata: { by: interaction.user.id }
          });

          await interaction.editReply({
            content: `✅ ${targetUser} に **${formatCoins(amount)}** を付与しました。現在の残高: ${formatCoins(balance.balance)}`
          });
          break;
        }
        case 'pay': {
          const amount = interaction.options.getInteger('amount', true);
          const reason = interaction.options.getString('reason') ?? '自己消費';

          const { balance } = await debit(interaction.user, amount, {
            reason,
            metadata: { method: 'command' }
          });

          await interaction.editReply({
            content: `🧾 ${formatCoins(amount)} を消費しました。残高: ${formatCoins(balance.balance)}${reason ? `（用途: ${reason}）` : ''}`
          });
          break;
        }
        default:
          await interaction.editReply({ content: '未知のサブコマンドです。' });
      }
    } catch (error) {
      await handleCurrencyError(interaction, error);
    }
  }
};
