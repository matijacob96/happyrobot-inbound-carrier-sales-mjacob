# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
WORKDIR /repo

# ---- build stage ----
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/dashboard apps/dashboard
RUN pnpm install --frozen-lockfile=false --prod=false
RUN pnpm --filter @hr/shared build && pnpm --filter @hr/dashboard build

# ---- runtime: nginx serving the SPA + BFF proxy to the API ----
FROM nginx:1.27-alpine AS runtime
# nginx:1.x will run /docker-entrypoint.sh, which renders any *.template under
# /etc/nginx/templates/ via envsubst before nginx starts. The FILTER below is
# critical so envsubst does NOT clobber nginx-native vars like $uri / $scheme.
COPY apps/dashboard/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/dashboard/dist /usr/share/nginx/html

ENV PORT=8080
ENV UPSTREAM_API=http://localhost:8080
ENV API_KEY=""
ENV NGINX_ENVSUBST_FILTER=^(PORT|UPSTREAM_API|API_KEY)$

EXPOSE 8080
