# syntax=docker/dockerfile:1.4
FROM node:24-trixie AS base

# Debian系: パッケージ更新と必要ツールのインストール
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# パッケージのインストール
COPY package*.json ./
RUN npm ci --omit=dev

# アプリ本体コピー
COPY . .

# Prismaクライアント生成
RUN npx prisma generate

# 本番環境設定
ENV NODE_ENV=production

# コンテナ起動時にマイグレーション＆Bot起動
CMD ["sh", "-c", "npx prisma migrate deploy && npm run deploy:commands && npm start"]
