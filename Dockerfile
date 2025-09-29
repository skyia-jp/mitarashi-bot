# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
CMD ["npm", "start"]
