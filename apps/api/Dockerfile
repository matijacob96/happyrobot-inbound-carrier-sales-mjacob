# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
WORKDIR /repo

# ---- deps stage ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false --prod=false

# ---- build stage ----
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @hr/shared build && pnpm --filter @hr/api build

# ---- runtime stage ----
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
WORKDIR /repo
ENV NODE_ENV=production \
    PORT=8080
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
RUN pnpm install --filter @hr/api --prod --frozen-lockfile=false

EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
