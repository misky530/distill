# Distill — Architecture

> 本文档反映 v3.1（2026年6月）实际落地的技术实现，与早期规划文档存在出入的地方已按真实情况更新。

## v3.1 Application Architecture（hackathon 期间实际构建）

```
Browser
  │  HTTP (同步请求，无SSE)
  ▼
Next.js 15 (App Router)
  │
  ├── /api/transcribe   → yt-dlp 下载音频 → 硅基流动 ASR → transcript
  │
  └── /api/generate     → LLM Router (内嵌于 lib/)
                              │
                    ┌─────────┴─────────┐
              DeepSeek-v4-pro      Kimi-k2.6
              (火山方舟coding)      (火山方舟coding)
                    └─────────┬─────────┘
                      Doubao-seed-2.0-pro
                          (Judge)
                              │
                         Winner + scores
```

关键说明：

- **同步处理**：`/api/transcribe` 和 `/api/generate` 都是阻塞式 HTTP 请求，没有队列、没有 SSE 进度推送。短视频（几分钟）端到端在 10-30 秒内完成，可接受。长视频（30分钟+）的体验优化留作 roadmap。
- **LLM Router 内嵌**：`services/llm-router/src/` 是源码归属地，但运行时代码被复制进 `apps/web/lib/`，与 Next.js API route 在同一进程内执行，没有独立部署、没有网络调用开销。这是有意的简化——当前只有一个消费者（web前端），引入微服务边界没有收益。
- **后续计划迁移到 n8n**：LLM Router 的编排逻辑（并行调用 + judge裁决）计划迁移到 n8n 工作流引擎，以获得可视化编排、更容易接入新模型/新judge，以及独立于 Next.js 部署的能力。当前内嵌实现是过渡方案。
- **统一API网关**：DeepSeek、Kimi、Doubao 三个模型并非来自三个不同厂商的API，而是通过火山方舟（Volcano Ark）的 coding plan 统一网关访问（`https://ark.cn-beijing.volces.com/api/coding/v3`），用同一个 API Key、不同的 model 参数区分。这简化了密钥管理，但也意味着三个"模型"的可用性和速率限制共享同一个账号配额。

## 转录管道（Transcription Pipeline）

```
POST /api/transcribe { url }
  │
  ▼
yt-dlp 下载音频
  │  --cookies (B站登录态，应对部分内容的访问限制)
  │  --force-overwrites --no-continue (防止复用失败的缓存文件)
  │  失败时降级：纯音频流(30280) → 视频+音频流再提取(bv*+ba/b)
  ▼
ffprobe 校验时长
  │  时长 < 10秒 → 判定为CDN截断异常，重试（最多3次，间隔1.5s）
  ▼
硅基流动 ASR (FunAudioLLM/SenseVoiceSmall)
  │  POST https://api.siliconflow.cn/v1/audio/transcriptions
  ▼
transcript (string) → 供 /api/generate 使用
```

这个管道是 v3.1 阶段踩坑最多、也最值得记录的部分（详见 [EXPERIENCE.md](./EXPERIENCE.md)）。核心难点不是"如何下载视频"，而是"如何确认下载到的是完整视频，而不是CDN返回的截断片段"——这是个静默失败（silent failure）问题：yt-dlp 报告下载成功，文件确实存在且大小合理，但实际播放时长只有5秒。

## 部署方案

应用通过 Docker Compose 单容器部署：

```
docker-compose.yml
  │
  ▼
Dockerfile (多阶段构建)
  │  Stage 1-2: pnpm install + Next.js build (standalone输出)
  │  Stage 3: 运行时镜像，安装 yt-dlp + ffmpeg + python3
  ▼
distill-web 容器
  │  Next.js standalone server (port 3000)
  │
  └── Volume挂载: bilibili-cookies.txt (只读，不打进镜像)
```

关键说明：

- **yt-dlp/ffmpeg 打进镜像**：转录管道依赖的两个二进制工具在 Dockerfile 的运行时阶段通过 `apt`/`pip` 安装，构建期会校验 `yt-dlp --version` 和 `ffmpeg -version` 确保安装成功，避免运行时才发现依赖缺失。
- **cookie 通过 volume 挂载，不打进镜像**：B站登录cookie是敏感凭证且会过期，打进镜像会导致每次cookie刷新都要重新构建镜像。当前方案是在宿主机准备好cookie文件，启动容器时只读挂载进去，更新cookie只需替换宿主机文件、重启容器，不需要重新build。
- **单账号cookie的已知限制**：当前用的是开发者个人的B站登录cookie，所有用户的转录请求共享同一个账号的登录态和限流额度。这是hackathon阶段的合理简化，但不适合真实多用户生产场景——真实上线时应该让用户自带cookie，或者直接支持上传本地视频文件，绕开"模拟用户在外部平台的登录态"这个脆弱依赖。

## 技术栈总览（更新版，反映实际情况）

| 层 | 技术 | 状态 |
|---|---|---|
| 前端 | Next.js 15 (App Router), TypeScript, React | ✅ 已实现 |
| LLM 编排 | 内嵌于 `apps/web/lib/`，计划迁移至 n8n | ✅ 已实现（过渡方案） |
| LLM 模型 | DeepSeek-v4-pro, Kimi-k2.6, Doubao-seed-2.0-pro（均通过火山方舟统一网关） | ✅ 已实现 |
| ASR | 硅基流动云端API（FunAudioLLM/SenseVoiceSmall） | ✅ 已实现 |
| 视频下载 | yt-dlp + cookie认证 + 格式降级重试 | ✅ 已实现（仅B站，抖音未测试） |
| 部署 | Docker Compose（单容器，多阶段构建） | ✅ 已实现 |
| 异步处理 | 无（同步HTTP阻塞） | ❌ Roadmap |
| 进度推送 | 无（SSE未实现） | ❌ Roadmap |
| 队列 | 无（BullMQ未集成） | ❌ Roadmap |
| ORM/数据库 | Drizzle ORM + PostgreSQL (pgvector) | ⚠️ 代码骨架存在，未验证是否接入业务逻辑 |

## 已知限制

- 转录管道目前依赖手动维护的 B站 cookie 文件，cookie 过期后需要重新从浏览器导出，没有自动刷新机制；且当前是开发者个人账号cookie，所有用户共享同一登录态（仅适用于hackathon demo场景）。
- 仅验证了 B站链接，抖音链接的解析逻辑虽然在 `route.ts` 中做了URL校验，但下载/转录流程未实际测试。
- 长视频（30分钟+）在当前同步HTTP模型下可能触发请求超时，需要异步化才能可靠支持。
- LLM Router 的三个模型共享同一个火山方舟账号配额，高并发场景下可能互相影响限流。

## Roadmap（真实上线方向）

- 去掉开发者个人cookie依赖：支持用户自带cookie，或直接支持上传本地视频/音频文件，绕开模拟登录态的脆弱性
- 异步任务队列 + 进度推送（BullMQ/SSE），支持长视频
- LLM Router 编排逻辑迁移至 n8n，便于可视化编排和接入新模型
