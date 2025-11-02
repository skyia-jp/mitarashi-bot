# syntax=docker/dockerfile:1.4

# ----------------------------
# Build Stage (Bun)
# ----------------------------
FROM oven/bun:slim AS builder
WORKDIR /app

# プロジェクト全体をコピー
COPY . .

# 依存関係をすべてインストール（devDependencies も含む）
RUN bun install

# ----------------------------
# Runtime Stage (本番用)
# ----------------------------
FROM oven/bun:slim AS runtime
WORKDIR /app

# 本番環境に必要なツールだけ追加
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends netcat-openbsd bash curl && \
    rm -rf /var/lib/apt/lists/*

# Builder から必要なファイルだけコピー
COPY --from=builder /app/package.json ./ 
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

ENV NODE_ENV=production

# Bot 起動コマンド
CMD ["sh", "-c", "bunx --bun prisma migrate deploy && bun run deploy:commands && bun start"]
