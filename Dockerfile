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
# Runtime Stage (Bun / Debian)
# ----------------------------
FROM oven/bun:debian AS runtime
WORKDIR /app

# 必要パッケージをaptで追加
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends netcat-openbsd bash curl && \
    rm -rf /var/lib/apt/lists/*

# ビルド成果物をコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./ 
COPY --from=builder /app . 

ENV NODE_ENV=production

CMD ["sh", "-c", "bun prisma migrate deploy && bun run deploy:commands && bun start"]
