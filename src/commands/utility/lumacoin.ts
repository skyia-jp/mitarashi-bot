import { PermissionFlagsBits, SlashCommandBuilder, Client, ChatInputCommandInteraction, User, EmbedBuilder } from 'discord.js';
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

function formatCoins(amount: number) {
  let n = Number((amount as any)?.balance ?? amount);
  if (!Number.isFinite(n)) n = 0;
  return `${intl.format(n)} Lumacoin`;
}

function buildBalanceEmbed(target: User, balance: any) {
  return {
    title: '💰 Lumacoin 残高',
    description: `${target} の所持金は **${formatCoins(balance)}** です。`,
    color: 0x3498db
  } as any;
}

function isOwnerOrAdmin(interaction: ChatInputCommandInteraction) {
  if (OWNER_IDS.includes(interaction.user.id)) return true;
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

async function handleCurrencyError(interaction: ChatInputCommandInteraction, error: unknown) {
  const err: any = error as any;
  if (err instanceof CurrencyError || err?.code) {
    const ctx = err.context ?? {};
    if (err.code === 'COOLDOWN_ACTIVE' && ctx.retryAt) {
      const retryTime = ctx.retryAt instanceof Date ? ctx.retryAt : new Date(ctx.retryAt);
      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('⏳ クールダウン中')
        .setDescription(`デイリーボーナスはまだ受け取れません。\n次回は <t:${Math.floor(retryTime.getTime() / 1000)}:R> に受け取れます。`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (err.code === 'INSUFFICIENT_FUNDS') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💸 残高不足')
        .setDescription(`残高が不足しています。\n現在: ${formatCoins(ctx.current ?? 0)}\n必要: ${formatCoins(ctx.required ?? 0)}`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(`⚠️ エラー: ${err.message}`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  throw error;
}

export default {
  data: new SlashCommandBuilder()
    .setName('lumacoin')
    .setDescription('Lumacoin の残高確認や送金、受け取りを行います。')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('balance')
        .setDescription('Lumacoin 残高を確認します。')
        .addUserOption((option) => option.setName('user').setDescription('確認するユーザー（省略時は自分）'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription('他のユーザーに Lumacoin を送ります。')
        .addUserOption((option) => option.setName('user').setDescription('送金先').setRequired(true))
        .addIntegerOption((option) => option.setName('amount').setDescription('送金額').setRequired(true).setMinValue(1))
        .addStringOption((option) => option.setName('reason').setDescription('送金理由（任意）'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('管理者として Lumacoin を付与します。')
        .addUserOption((option) => option.setName('user').setDescription('付与対象').setRequired(true))
        .addIntegerOption((option) => option.setName('amount').setDescription('付与額').setRequired(true).setMinValue(1))
        .addStringOption((option) => option.setName('reason').setDescription('付与理由（任意）'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('pay')
        .setDescription('自身の Lumacoin を消費します。')
        .addIntegerOption((option) => option.setName('amount').setDescription('消費額').setRequired(true).setMinValue(1))
        .addStringOption((option) => option.setName('reason').setDescription('用途（任意）'))
    )
    .addSubcommand((sub) => sub.setName('daily').setDescription('デイリーボーナスを受け取ります。')),
  async execute(client: Client, interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'balance': {
          const target = (interaction.options.getUser('user') ?? interaction.user) as User;
          const balance = await getBalance(interaction.guild, target as any);
          const embed = buildBalanceEmbed(target, balance?.balance ?? balance);
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'daily': {
          const daily = (await claimDaily(interaction.guild, interaction.user)) as any;
          const reward = daily.reward;
          const balance = daily.balance;
          const nextClaimAt = daily.nextClaimAt ? new Date(daily.nextClaimAt) : new Date();
          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🎁 デイリーボーナス')
            .setDescription(`**${formatCoins(reward)}** を受け取りました！\n次回は <t:${Math.floor(nextClaimAt.getTime() / 1000)}:R> に受け取れます。\n現在の残高: ${formatCoins(balance?.balance ?? balance)}`);
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'give': {
          const targetUser = interaction.options.getUser('user', true) as User;
          const amount = interaction.options.getInteger('amount', true) as number;
          const reason = interaction.options.getString('reason') ?? undefined;

          const result = (await transfer(interaction.guild, interaction.user, targetUser as any, amount, {
            reason,
            metadata: { method: 'command' }
          } as any)) as any;

          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🤝 送金完了')
            .setDescription(`${targetUser} に **${formatCoins(amount)}** を送金しました。`)
            .addFields(
              { name: 'あなたの残高', value: formatCoins(result.sender.balance.balance), inline: true },
              { name: '相手の残高', value: formatCoins(result.recipient.balance.balance), inline: true }
            );
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'add': {
          if (!isOwnerOrAdmin(interaction)) {
            const embed = new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription('❌ この操作を行う権限がありません。');
            await interaction.editReply({ embeds: [embed] });
            return;
          }

          const targetUser = interaction.options.getUser('user', true) as User;
          const amount = interaction.options.getInteger('amount', true) as number;
          const reason = interaction.options.getString('reason') ?? '管理者付与';

          const creditRes = (await credit(interaction.guild, targetUser as any, amount, {
            type: TRANSACTION_TYPES.ADJUST,
            reason,
            metadata: { by: interaction.user.id }
          } as any)) as any;

          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ 付与完了')
            .setDescription(`${targetUser} に **${formatCoins(amount)}** を付与しました。\n現在の残高: ${formatCoins(creditRes.balance.balance)}`);
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        case 'pay': {
          const amount = interaction.options.getInteger('amount', true) as number;
          const reason = interaction.options.getString('reason') ?? '自己消費';

          const debitRes = (await debit(interaction.guild, interaction.user, amount, {
            reason,
            metadata: { method: 'command' }
          } as any)) as any;

          const embed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle('🧾 消費完了')
            .setDescription(`${formatCoins(amount)} を消費しました。\n残高: ${formatCoins(debitRes.balance.balance)}${reason ? `\n（用途: ${reason}）` : ''}`);
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        default: {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('❌ 未知のサブコマンドです。');
          await interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      await handleCurrencyError(interaction, error as any);
    }
  }
};
