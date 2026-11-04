# syntax=docker/dockerfile:1

FROM node:26-alpine AS base
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

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/sync-protocol ./packages/sync-protocol
COPY apps/server ./apps/server
WORKDIR /app/apps/server
RUN pnpm prisma:generate \
  && REWRITE_PROTOCOL_EXPORTS=1 pnpm build

# Production dependencies only (no tsx / vitest / @types). Prisma stays a
# dependency so migrate works; postinstall generates the client and fetches engines.
FROM base AS prod-deps
COPY --chmod=0644 package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/server/prisma ./apps/server/prisma
COPY apps/server/prisma.config.ts ./apps/server/prisma.config.ts
COPY packages/sync-protocol/package.json ./packages/sync-protocol/
# --ignore-scripts skips root `prepare: husky` (not in the prod graph). Prisma
# engines + client are fetched explicitly next.
RUN pnpm install --frozen-lockfile --filter spaced_rep_pwa_server... --prod --ignore-scripts \
  && pnpm --filter spaced_rep_pwa_server exec prisma generate

FROM base AS production
ENV NODE_ENV=production
# The image installs only the server's workspace slice. Without this, pnpm 12
# sees a stale node_modules at start and tries to reinstall as the non-root user.
ENV pnpm_config_verify_deps_before_run=false
COPY --from=prod-deps /app ./
COPY --from=build /app/packages/sync-protocol/package.json ./packages/sync-protocol/package.json
COPY --from=build /app/packages/sync-protocol/dist ./packages/sync-protocol/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
# Engines and generated client were written as root; the runtime user must own them.
RUN chown -R node:node /app
WORKDIR /app/apps/server
USER node
EXPOSE 3000
# Migrations are run separately (never on container start)
CMD ["node", "dist/server.js"]
