# syntax=docker/dockerfile:1

# ---------- Build ----------
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

# Variáveis VITE_* são embutidas no bundle do cliente em tempo de build.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

RUN bun run build

# ---------- Runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# O preset node-server do Nitro gera um servidor autocontido em .output
COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

# Variáveis de runtime (passar no deploy):
#   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
CMD ["node", ".output/server/index.mjs"]
