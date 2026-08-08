# EduCore API image — build from repository root:
#   docker build -f apps/api/Dockerfile -t educore-api:local .
#
# Fly staging:
#   fly deploy -c infra/fly/educore-api.staging.toml

# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Workspace lockfile needs all workspace package.json files present.
COPY package.json package-lock.json .npmrc tsconfig.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages packages

RUN npm ci

COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

RUN npm run build -w @educore/api

# Runtime installs only @educore/api prod deps (no Next.js from apps/web).
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    SERVICE_NAME=educore-api

RUN groupadd --system --gid 1001 educore \
  && useradd --system --uid 1001 --gid educore --create-home educore

COPY apps/api/package.json ./
RUN npm install --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist ./dist

USER educore

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
