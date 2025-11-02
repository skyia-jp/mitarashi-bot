# syntax=docker/dockerfile:1.4

# ----------------------------
# Builder Stage (Node)
# ----------------------------
FROM node:24-trixie-slim AS builder

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends bash curl unzip openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存インストール
COPY package*.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# Prisma Client 生成
COPY . .
RUN npx prisma generate


# ----------------------------
# Runtime Stage (Bun)
# ----------------------------
FROM oven/bun:1 AS runtime
WORKDIR /app

# Bun環境でもMySQL待機に必要なnetcatを追加
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*

# ビルド成果物をコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./ 
COPY --from=builder /app . 

# 環境設定
ENV NODE_ENV=production

# Bun起動前にMySQL待機スクリプトを実行（もし用意している場合）
# 例: wait-for-mysql.sh があればこのように書く
# COPY scripts/wait-for-mysql.sh /usr/local/bin/wait-for-mysql.sh
# RUN chmod +x /usr/local/bin/wait-for-mysql.sh

# CMDでマイグレーション・コマンドデプロイ・Bot起動
CMD ["sh", "-c", "bun prisma migrate deploy && bun run deploy:commands && bun start"]
