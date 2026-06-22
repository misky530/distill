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

## 部署

部署在一台独立服务器上，用 `docker compose up -d` 启动，通过既有的 nginx + frp 隧道对外暴露（域名 → ECS → nginx → frp → 服务器 → 容器）。手动部署，没有CI/CD，这是为了在 hackathon 时间窗口内优先把功能做出来，不是长期方案。

> 另有一套自托管 K8s + ArgoCD GitOps 基础设施，服务于其他项目，与本次提交无关，故不在此展开。

## 技术栈总览（更新版，反映实际情况）

| 层 | 技术 | 状态 |
|---|---|---|
| 前端 | Next.js 15 (App Router), TypeScript, React | ✅ 已实现 |
| LLM 编排 | 内嵌于 `apps/web/lib/`，计划迁移至 n8n | ✅ 已实现（过渡方案） |
| LLM 模型 | DeepSeek-v4-pro, Kimi-k2.6, Doubao-seed-2.0-pro（均通过火山方舟统一网关） | ✅ 已实现 |
| ASR | 硅基流动云端API（FunAudioLLM/SenseVoiceSmall） | ✅ 已实现 |
| 视频下载 | yt-dlp + cookie认证 + 格式降级重试 | ✅ 已实现（仅B站，抖音未测试） |
| 异步处理 | 无（同步HTTP阻塞） | ❌ Roadmap |
| 进度推送 | 无（SSE未实现） | ❌ Roadmap |
| 队列 | 无（BullMQ未集成） | ❌ Roadmap |
| ORM/数据库 | Drizzle ORM + PostgreSQL (pgvector) | ⚠️ 代码骨架存在，未验证是否接入业务逻辑 |
| 部署 | 独立服务器 + docker compose（手动 `up -d`，无CI/CD） | ✅ 已实现 |

## 已知限制

- 转录管道目前依赖手动维护的 B站 cookie 文件，cookie 过期后需要重新从浏览器导出，没有自动刷新机制。
- 仅验证了 B站链接，抖音链接的解析逻辑虽然在 `route.ts` 中做了URL校验，但下载/转录流程未实际测试。
- 长视频（30分钟+）在当前同步HTTP模型下可能触发 Next.js / 反向代理的请求超时，需要异步化才能可靠支持。
- LLM Router 的三个模型共享同一个火山方舟账号配额，高并发场景下可能互相影响限流。
- 部署没有CI/CD，更新代码需要手动登录服务器操作；没有健康检查/自动重启，容器异常退出后需要人工介入。这是为赶 hackathon deadline 做的临时简化，不是长期方案。
