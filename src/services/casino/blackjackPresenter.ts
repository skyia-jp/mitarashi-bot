import { BlackjackResult, summarize } from './blackjackService.js';
import { formatHand } from './cards.js';

const intl = new Intl.NumberFormat('ja-JP');

function formatCoins(amount: number) {
  let n = Number((amount as any)?.balance ?? amount);
  if (!Number.isFinite(n)) n = 0;
  return `${intl.format(Math.trunc(n))} Lumacoin`;
}

function translateResult(result: string, options: { initialBlackjack?: boolean } = {}) {
  if (result === BlackjackResult.PLAYER_WIN) {
    return options.initialBlackjack ? 'ブラックジャック！あなたの勝ち！' : 'あなたの勝ち！';
  }
  if (result === BlackjackResult.DEALER_WIN) {
    return 'ディーラーの勝ち…';
  }
  if (result === BlackjackResult.PUSH) {
    return '引き分け';
  }
  return '進行中';
}

function translateAction(action: any) {
  switch (action.type) {
    case 'hit':
      return 'ヒット';
    case 'stand':
      return 'スタンド';
    case 'double':
      return 'ダブルダウン';
    case 'dealer_hit':
      return 'ディーラー → ヒット';
    default:
      return action.type;
  }
}

export function buildBlackjackEmbed(session: any, { revealDealer = session.state.finished, statusMessage, balanceInfo }: any = {}) {
  const summary = summarize(session.state);
  const dealerHandText = revealDealer ? summary.dealer.text : formatHand(session.state.dealerHand, true);
  const dealerValue = revealDealer ? summary.dealer.value : '??';
  const playerValue = summary.player.value;

  const descriptionLines = [`🧑 あなた: **${playerValue}**`, `🤖 ディーラー: **${dealerValue}**`];

  if (statusMessage) {
    descriptionLines.push(statusMessage);
  }

  const embed: any = {
    title: 'ブラックジャック',
    description: descriptionLines.join('\n'),
    color: session.state.finished ? (session.state.result === BlackjackResult.PLAYER_WIN ? 0x2ecc71 : session.state.result === BlackjackResult.DEALER_WIN ? 0xe74c3c : 0xf1c40f) : 0x1abc9c,
    fields: [
      {
        name: 'あなたの手札',
        value: `\`${summary.player.text}\``
      },
      {
        name: revealDealer ? 'ディーラーの手札' : 'ディーラーの手札（ホールカード非公開）',
        value: `\`${dealerHandText}\``
      }
    ],
    footer: { text: '' },
    timestamp: new Date().toISOString()
  };

  const actionHistory = session.state.actions.filter((action: any) => action.type !== 'dealer_hit').map(translateAction);
  if (actionHistory.length > 0) {
    embed.fields.push({ name: 'あなたの操作', value: actionHistory.join(' → ') });
  }

  if (session.wager?.initial > 0) {
    const totalBet = session.state.betAmount ?? session.wager.initial;
    const net = session.wager.netChange ?? -session.wager.initial;
    const lines = [`初期ベット: ${formatCoins(session.wager.initial)}`];

    if (session.wager.doubleDown) {
      lines.push(`ダブルダウン後の合計: ${formatCoins(totalBet)}`);
    } else {
      lines.push(`現在の合計ベット: ${formatCoins(totalBet)}`);
    }

    if (session.state.finished) {
      lines.push(`最終収支: ${formatCoins(net)}`);
    } else {
      lines.push(`確定済み収支: ${formatCoins(net)}`);
    }

    if (balanceInfo?.currentBalance != null) {
      lines.push(`現在の残高: ${formatCoins(balanceInfo.currentBalance)}`);
    }

    embed.fields.push({ name: 'ベット情報', value: lines.join('\n') });
  }

  const footerParts: string[] = [];
  if (session.bias?.winRate != null) {
    footerParts.push(`勝率補正: ${Math.round(session.bias.winRate * 100)}%`);
  }
  if (session.bias?.rerollChance) {
    footerParts.push(`再配布チャンス: ${Math.round(session.bias.rerollChance * 100)}%`);
  }
  footerParts.push(translateResult(session.state.result, session.state));
  embed.footer.text = footerParts.filter(Boolean).join(' | ');

  return embed;
}

export function buildBlackjackComponents(session: any) {
  const baseId = `blackjack:${session.id}`;
  const finished = session.state.finished;
  const alreadyActed = session.state.actions.some((action: any) => action.type === 'hit' || action.type === 'double');
  const doubleDisabled = finished || session.wager?.initial <= 0 || alreadyActed || session.wager?.doubleDown;

  return [
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: 'ヒット', custom_id: `${baseId}:hit`, disabled: finished },
        { type: 2, style: 3, label: 'スタンド', custom_id: `${baseId}:stand`, disabled: finished },
        { type: 2, style: 2, label: 'ダブルダウン', custom_id: `${baseId}:double`, disabled: doubleDisabled }
      ]
    }
  ];
}

export function resultToOutcome(result: string) {
  if (result === BlackjackResult.PLAYER_WIN) return 'player';
  if (result === BlackjackResult.DEALER_WIN) return 'dealer';
  if (result === BlackjackResult.PUSH) return 'draw';
  return 'progress';
}
