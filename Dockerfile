# syntax=docker/dockerfile:1.4

# Builder: use Node to run npm ci and generate Prisma client (devDependencies needed)
FROM node:24-trixie-slim AS builder

# 必要パッケージ（curl は npx 等で使う可能性があるため）
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends bash curl unzip openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存だけ先にインストール（package-lock.json があれば決定論的）
COPY package*.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# アプリ本体コピーして prisma client を生成
COPY . .
RUN npx prisma generate


# Runtime: use official oven/bun image for running Bun-based app
FROM oven/bun:1 AS runtime
WORKDIR /app

# Copy node_modules and app files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app .

# 本番環境設定
ENV NODE_ENV=production

# コンテナ起動時にマイグレーション＆Bot起動
CMD ["sh", "-c", "bun prisma migrate deploy && bun run deploy:commands && bun start"]
