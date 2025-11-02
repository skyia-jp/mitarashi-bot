# syntax=docker/dockerfile:1.4
FROM node:24-trixie-slim AS base

# 必要パッケージ
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends curl unzip openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bun インストール
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# パッケージインストール（開発依存も含めて一旦インストールして prisma などを使えるようにする）
COPY package*.json bun.lockb* ./
RUN bun install

# アプリ本体コピー
COPY . .

# Prismaクライアント生成
# prisma CLI は devDependency に含まれることがあるため、dev 依存を含めて生成する
RUN bun prisma generate

# 本番環境設定
ENV NODE_ENV=production

# コンテナ起動時にマイグレーション＆Bot起動
# 本番用に事前ビルドしていない場合は Bun が直接 .ts を実行します。
CMD ["sh", "-c", "bun prisma migrate deploy && bun run deploy:commands && bun start"]
