# ── Stage 1: Base ──────────────────────────────────────────────
FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# ── Stage 2: Dependencies ──────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ── Stage 3: Builder ───────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ── Stage 4: Runner ────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN mkdir -p logs

EXPOSE 3001

CMD ["node", "dist/main"]
