# ── Stage 1: 依赖安装 ──
FROM node:20-slim AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY apps/web/package.json apps/web/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# ── Stage 2: 构建 ──
FROM node:20-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./

# apps/web/pnpm-workspace.yaml 只是approve-builds生成的依赖白名单，没有packages字段，
# 但pnpm一旦发现该文件存在就会把当前目录当成workspace根目录、强制要求packages字段非空。
# 容器内只构建单个app，不需要workspace语义，直接删除该文件即可恢复单包构建行为。
RUN rm -f pnpm-workspace.yaml

RUN pnpm build

# ── Stage 3: 运行时 ──
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# 安装运行时依赖：python3(yt-dlp需要) + ffmpeg + curl(健康检查用)
# 换成阿里云镖像源，规避deb.debian.org的GPG签名校验间歇性失败问题
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list 2>/dev/null || true

RUN apt-get -o Acquire::Check-Valid-Until=false \
    -o Acquire::AllowInsecureRepositories=true \
    -o Acquire::AllowDowngradeToInsecureRepositories=true \
    update
RUN apt-get install -y --no-install-recommends --allow-unauthenticated \
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
