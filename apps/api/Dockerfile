FROM node:20-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --no-frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY tsconfig.json* ./

ENV DATABASE_PROVIDER=postgresql
RUN pnpm --filter @atlas/shared build \
  && cd apps/api \
  && node scripts/set-provider.mjs \
  && npx prisma generate \
  && cd /app \
  && pnpm --filter @atlas/api build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000
ENV UPLOAD_DIR=/app/uploads

COPY --from=build /app /app
RUN mkdir -p /app/uploads && chmod +x /app/apps/api/docker-entrypoint.sh

EXPOSE 4000
CMD ["/app/apps/api/docker-entrypoint.sh"]
