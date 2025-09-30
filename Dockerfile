# syntax=docker/dockerfile:1.4
FROM node:20-alpine3.18 AS base

RUN apk add --no-cache openssl1.1-compat

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production
CMD ["npx", "prisma", "db", "push", "&&","npm", "start"]