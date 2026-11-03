# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
# Keep the prepared pnpm where the non-root runtime user finds it, so starting
# the container never re-downloads pnpm.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate \
  && chown -R node:node /opt/corepack
WORKDIR /app

FROM base AS deps
# Explicit mode: build-context file modes (e.g. 0600) must not lock out USER node.
COPY --chmod=0644 package.json pnpm-lock.yaml pnpm-workspace.yaml ./
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

FROM base AS production
ENV NODE_ENV=production
# The image installs only the server's workspace slice. Without this, pnpm 12
# sees a stale node_modules at start and tries to reinstall as the non-root user.
ENV pnpm_config_verify_deps_before_run=false
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/sync-protocol ./packages/sync-protocol
COPY apps/server ./apps/server
WORKDIR /app/apps/server
RUN pnpm prisma:generate
USER node
EXPOSE 3000
# Migrations are run separately (never on container start)
CMD ["pnpm", "start"]
