# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY packages/sync-protocol/package.json ./packages/sync-protocol/
# Schema is not available in this stage; generate after the full server tree is copied
RUN pnpm install --frozen-lockfile --filter spaced_rep_pwa_server... --ignore-scripts

FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/sync-protocol ./packages/sync-protocol
COPY apps/server ./apps/server
WORKDIR /app/apps/server
RUN pnpm prisma:generate
EXPOSE 3000
# Migrations are run separately (never on container start)
CMD ["pnpm", "dev"]
