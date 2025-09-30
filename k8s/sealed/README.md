## 概要

`k8s/sealed/` ディレクトリは Bitnami Sealed Secrets コントローラと `kubeseal` CLI を使って Kubernetes Secret を Git 管理するためのテンプレート置き場です。リポジトリに含まれている `cert.pem` は **公開鍵だけ** を含むファイルで、Secret を暗号化する際に `kubeseal --cert` オプションで利用できます（秘密鍵はコントローラ側にのみ存在します）。

## 前提

- クラスタに Sealed Secrets コントローラがデプロイ済みであること（例: `kube-system` ネームスペースの `sealed-secrets` Deployment）。
- `kubectl` と `kubeseal` CLI がローカルにインストール済みであること。
- クラスタごとに公開鍵は異なります。`cert.pem` はあくまで任意の環境向けのサンプルです。別クラスタで利用する場合はそのクラスタの公開鍵を取得して差し替えてください。

## 公開鍵 (`cert.pem`) の扱い

### 1. 既存の `cert.pem` をそのまま使う場合

1. `cert.pem` が想定クラスタの公開鍵と一致していることを確認します。
	- クラスタから再取得した公開鍵と差分を確認する (`diff` 等)。
2. `kubeseal` 実行時に `--cert k8s/sealed/cert.pem` を指定します。

```powershell
kubectl create secret generic mitarashi-bot `
	--namespace ibuki-mitarashi-bot `
	--from-literal=DISCORD_BOT_TOKEN=xxx `
	--from-literal=DATABASE_URL="mysql://user:pass@mitarashi-bot-db:3306/mitarashi" `
	--dry-run=client -o yaml > secret.yaml

Get-Content -Raw secret.yaml | kubeseal `
	--format yaml `
	--cert k8s/sealed/cert.pem `
	> k8s/sealed/env.yaml
```

### 2. クラスタから新しい公開鍵を取得する場合

Secret を暗号化したいクラスタに接続した状態で以下を実行します。

```powershell
kubeseal --controller-name sealed-secrets `
	--controller-namespace kube-system `
	--fetch-cert > k8s/sealed/cert.pem
```

- デフォルトのコントローラ名/ネームスペースを変更している場合は、それぞれ `--controller-name` と `--controller-namespace` で明示します。
- 公開鍵 (`cert.pem`) をリポジトリに含めるのは問題ありませんが、秘密鍵は絶対に公開しないでください。

### 3. ローテーションとマルチクラスタ

- コントローラの公開鍵は証明書ローテーションで更新されることがあります。Sealed Secret の復号に失敗するようになった場合は新しい公開鍵を取得し直して `cert.pem` を差し替えます。
- 複数クラスタにデプロイする場合はクラスタごとに公開鍵が異なるため、クラスタごとの `cert-<cluster>.pem` を用意し、`kubeseal --cert` で使い分けるか `--controller-*` オプションでクラスタに直接問い合わせるようにしてください。

## Sealed Secret の運用フロー例

1. 平文 Secret をローカルで作成（`kubectl create secret ... --dry-run=client`）。
2. `kubeseal` で暗号化し、`k8s/sealed/*.yaml` に保存。
3. Sealed Secret を Git にコミット。
4. 本番環境では Argo CD や `kubectl apply` で Sealed Secret を適用。コントローラが自動的に通常の Secret に復号します。

```powershell
kubectl apply -f k8s/sealed/env.yaml
```

- 既存 Secret を差し替える場合は同じ名前にしておけばコントローラが Secret をローリング更新します。
- Sealed Secret を削除すると元の Secret も一緒に削除される点に注意してください。

## セキュリティ上の注意

- 公開鍵 (`cert.pem`) は公開しても問題ありませんが、第三者が暗号化した Sealed Secret を適用するとクラスタ内で Secret が生成されてしまう可能性があるので、RBAC で不要な権限を与えないようにしてください。
- 個人のローカルに古い `cert.pem` が残っていると暗号化に失敗することがあるため、定期的に破棄・更新する運用を推奨します。
- `kubeseal` を実行する環境では、平文 Secret の一時ファイル (`secret.yaml`) を残さないように注意し、作業後は即座に削除してください。

以上を押さえておけば、`kubeseal` と `cert.pem` を組み合わせて安全に Secret を GitOps 管理できます。
