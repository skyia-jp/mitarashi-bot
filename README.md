# Discord Utility Bot
多機能な Discord Bot プロジェクトです。リマインダー、ロールセレクター、メッセージピン留め、用語規制、モデレーションなどの機能を備えています。音声関連機能（VoiceVox 連携など）は後続フェーズで実装します。

## ✨ 機能ハイライト

- **固定メッセージの再掲:** チャンネル下部に常時表示されるよう、ピン留め対象を複製して固定表示します。
- **チンチロミニゲーム:** `/chinchiro` で Bot とサイコロ勝負。役判定とリプレイに対応。
- **ポーカーミニゲーム:** `/poker` で 5 カードポーカーをプレイし、役判定と勝敗を即座に表示します。
- **勝率補正機構:** ミニゲームで連敗すると勝率が段階的に上昇し、勝利すると既定値にリセットされるフェイルセーフ付き。
- **投票システム:** `/poll create` で匿名投票を作成し、リアルタイムに票数と割合を集計します。
- **メモ／タスク管理:** `/note` と `/task` コマンドでギルド内の共有メモやタスクを管理します。
- **サーバー統計と設定:** `/server stats` や `/server config` でメンバー状況の把握や自動ロール設定が可能です。
- **アクティビティサマリー自動化:** メッセージ数や VC 滞在時間を記録し、定期レポートとリーダーボードを提供します。

## 🧱 技術スタック

- Node.js 18+
- Discord.js v14
- Prisma + MySQL
- node-cron
- Docker / Docker Compose
- Kubernetes + ArgoCD（デプロイ用マニフェストを同梱）

## 🚀 セットアップ

1. 依存関係をインストールします。

   ```powershell
   npm install
   ```

2. `.env` を作成し、Discord Bot Token や DB 接続情報を記述します。

   ```powershell
   copy .env.example .env
   ```

3. Prisma クライアントを生成し、DB をマイグレーションします。

   ```powershell
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. Bot を起動します。

   ```powershell
   npm run dev
   ```

## 🧩 主なスクリプト

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発モードで Bot を起動します（自動再起動付き）。 |
| `npm start` | 本番モードで Bot を起動します。 |
| `npm run deploy:commands` | Slash Command を Discord にデプロイします。 |
| `npm run prisma:migrate` | Prisma のマイグレーションを実行します。 |
| `npm run prisma:generate` | Prisma Client を再生成します。 |
| `npm run prisma:studio` | Prisma Studio を起動します。 |
| `npm run lint` | ESLint で静的解析を実行します。 |

## 🗂️ プロジェクト構成

```
src/
  bot/
    client.js
    events/
      ready.js
      interactionCreate.js
      messageCreate.js
  commands/
    admin/
    moderation/
    utility/
  services/
  database/
  utils/
  config/
  interactions/
prisma/
  schema.prisma
scripts/
  deploy-commands.js
```

## 🧪 テスト

現時点では自動テストは用意していません。静的解析（`npm run lint`）に通ることを確認してください。

## �️ 主なコマンド

### 🎮 ユーティリティ

| コマンド | 用途 |
| --- | --- |
| `/pin` | メッセージをチャンネルの最下部に固定／解除します。 |
| `/chinchiro` | Bot と 1 対 1 のチンチロ勝負を行います。 |
| `/poker` | Bot と 5 カードポーカーで勝負します。役名とキッカー情報を確認できます。 |
| `/poll create` / `/poll close` / `/poll results` | 投票の作成・締切・結果確認を行います。 |
| `/note add` / `/note list` / `/note delete` | ギルド共有メモを管理します。 |
| `/task add` / `/task list` / `/task update` / `/task complete` | タスクの登録・担当者設定・ステータス変更を行います。 |
| `/activity leaderboard` | 直近のメッセージ数と VC 滞在時間のランキングを表示します。 |

### 🛡️ 管理

| コマンド | 用途 |
| --- | --- |
| `/server stats` | ギルドのメンバー統計とアクティビティ概要を表示します。 |
| `/server config view` / `/server config set` | 自動ロールやログチャンネル、タイムゾーン設定を管理します。 |
| `/job activity enable` / `disable` / `configure` / `status` | アクティビティサマリーの自動配信を制御します。 |
| `/rolemenu`、`/filter` など既存の管理系コマンドも継続利用できます。 |

> Slash Command を新規追加・更新した際は `npm run deploy:commands` を実行して Discord に反映してください。

## �📦 Docker

ローカル開発用の Dockerfile と docker-compose.yml を用意しています。MySQL コンテナと Bot コンテナをまとめて起動できます。

```powershell
docker compose up --build
```

## ☸️ Kubernetes / ArgoCD

`k8s/` 配下に Kubernetes マニフェスト、`argocd/` 配下に ArgoCD Application の定義を用意しています。環境に応じて値を調整してから適用してください。

---

今後のロードマップ:

- VoiceVox API を用いた音声読み上げ
- 自動ロール付与の高度化
- 監視ダッシュボード
