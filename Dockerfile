# ── Stage 1: 依赖安装 ──
FROM node:20-slim AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY apps/web/package.json apps/web/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# ── Stage 2: 构建 ──
FROM node:20-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./

RUN pnpm build

# ── Stage 3: 运行时 ──
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# 安装运行时依赖：python3(yt-dlp需要) + ffmpeg + curl(健康检查用)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 用pip安装yt-dlp（比apt仓库的版本更新更及时）
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# 确认安装成功（构建期校验，失败则直接中断build）
RUN yt-dlp --version && ffmpeg -version

# 非root用户运行
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
