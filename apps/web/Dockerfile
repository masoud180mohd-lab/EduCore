# EduCore web image — build from repository root:
#   docker build -f apps/web/Dockerfile -t educore-web:local .
#
# Fly:
#   fly deploy -c infra/fly/educore-web.staging.toml --remote-only

# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc tsconfig.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages packages

RUN npm ci

COPY apps/web apps/web

ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build -w @educore/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    SERVICE_NAME=educore-web

RUN groupadd --system --gid 1001 educore \
  && useradd --system --uid 1001 --gid educore --create-home educore

COPY --from=build --chown=educore:educore /app/apps/web/.next/standalone ./
COPY --from=build --chown=educore:educore /app/apps/web/.next/static ./apps/web/.next/static

USER educore

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
