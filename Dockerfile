# syntax=docker/dockerfile:1.4

# ----------------------------
# Build Stage (Bun)
# ----------------------------
FROM oven/bun:slim AS builder
WORKDIR /app

COPY . .
RUN bun install --production=false

# ----------------------------
# Runtime Stage
# ----------------------------
FROM oven/bun:slim AS runtime
WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends netcat-openbsd bash curl

# 必要なファイルだけコピー
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

ENV NODE_ENV=production

CMD ["sh", "-c", "bunx --bun prisma migrate deploy && bun run deploy:commands && bun start"]
