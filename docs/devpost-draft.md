# Distill — Devpost Submission Draft
> FutureAI Global Hackathon 2026 | 截止 2026年7月5日 19:30 GMT+8
> 本文件用于 Claude Project 知识库，记录 Devpost 各字段的当前草稿内容

---

## 1. Project Name
```
Distill — Turn Any Video into Knowledge
```

---

## 2. Elevator Pitch（200字符以内）
```
Paste a video link, get structured knowledge: AI transcribes, summarizes, and generates mind maps in minutes. Built for students drowning in 3-hour lectures. Live in production, self-hosted ASR + multi-LLM.
```

---

## 3. About the Project（正文 Markdown，粘贴进 Devpost 大文本框）

## Inspiration

Exam-prep students in China routinely face 3-hour lecture videos on Bilibili and Douyin. Tools like NotebookLM serve YouTube and English content — China's 200M+ exam-prep learners have nothing equivalent. Watching at 2x speed still wastes time, and nothing gets retained as reviewable notes. I built Distill to turn passive video watching into structured, reusable knowledge assets — transcripts, summaries, documents, and mind maps.

## What it does

Paste a video link (Bilibili / Douyin) or upload a file, and Distill:

1. **Transcribes** it with a self-hosted SenseVoice ASR engine (lower cost, better privacy than cloud ASR)
2. **Generates** an adaptive-structure summary and a structured study document via LLM
3. **Renders** a Mermaid mind map for visual review
4. **Streams progress in real time** — long videos are processed asynchronously with live status updates (built during this hackathon)
5. **Compares multiple LLMs side by side** — DeepSeek and Qwen generate in parallel; Doubao acts as an independent judge and picks the better output (built during this hackathon)

The product is live at https://wd-ai.cloud.

## How we built it

**Built during this hackathon (v3):**
- A custom **LLM Router service** replacing the previous n8n orchestration: multi-model parallel generation (DeepSeek / Qwen), per-plan model routing, and SSE streaming output
- **LLM-as-judge**: Doubao evaluates both outputs on coverage, structure, and factuality — third-party judge avoids self-preference bias
- **Async task pipeline**: BullMQ + Redis queue with Redis pub/sub pushing progress to the browser over SSE — eliminating timeouts on long videos
- New **Next.js 15 (App Router)** frontend with TypeScript and Drizzle ORM + PostgreSQL

**Pre-existing foundation (v2, in production since before the hackathon):**
- Self-hosted 3-node Kubernetes cluster with a GitOps delivery pipeline (GitLab CI → private registry → ArgoCD auto-sync); every commit auto-deploys
- Public ingress chain solving a no-public-IP constraint: domain → Alibaba Cloud ECS → nginx → frp tunnel → K8s NodePort
- Locally deployed SenseVoice ASR as the transcription engine

## Challenges we ran into

- **Mermaid rendering reliability**: LLMs love generating invalid graph syntax. Constraining output to a strict tree structure dramatically reduced render failures.
- **Prompt structure vs. content diversity**: forcing a fixed What/Why/How template degraded quality on general-purpose videos; we switched to adaptive structuring based on content type.
- **Long-video timeouts**: synchronous processing broke on 1h+ videos — solved this hackathon with the BullMQ async pipeline and SSE progress streaming.
- **Production debugging on self-hosted infra**: a multi-layered image-pull failure (per-node containerd auth + registry visibility) taught me more about K8s internals than any tutorial.

## What we learned

Shipping an AI product solo means the bottleneck is rarely the model — it's orchestration, output reliability, and infrastructure. Prompt engineering is empirical: measure, don't assume. And a production-grade deployment pipeline pays for itself the moment you need to iterate fast under a deadline.

## What's next

- Two-tier LLM caching (Redis exact-match + pgvector semantic cache) to cut inference costs
- Observability stack: structured logs → Loki + Grafana, then distributed tracing
- WeChat Mini Program login for the Chinese market
- Pluggable judge model (swap Doubao → Claude via one config change)

---

## 4. Built With 标签（逗号分隔，填入 Devpost 标签框）
```
nextjs, typescript, kubernetes, argocd, gitlab-ci, postgresql, redis, bullmq, drizzle-orm, deepseek, qwen, sensevoice, mermaid, nginx, frp, docker
```

---

## 5. Try it out 链接
- 线上产品：https://wd-ai.cloud
- GitHub 仓库：https://github.com/YOUR_USERNAME/distill（上线后替换）

---

## 6. 待办事项（提交前必须完成）
- [ ] GitHub 仓库建好后替换第5条链接
- [ ] 录制 demo 视频上传 YouTube，填入 Video demo link
- [ ] 上传产品截图到 Image gallery（思维导图页、双模型对比页、架构图、文档输出页）
- [ ] 补测思维导图渲染失败率真实数据（可选，有数据更有说服力）
- [ ] 确保 wd-ai.cloud 首页有英文入口，评委无需注册可体验 demo
- [ ] 7月3日前完成首次提交（留48小时缓冲）

---

## 7. Demo 视频分镜脚本（3分钟）

| 时间 | 画面 | 内容 |
|---|---|---|
| 0:00-0:20 | 痛点场景 | B站3小时考研课程页面，字幕："3-hour lectures. Zero notes. Sound familiar?" |
| 0:20-0:50 | 核心流程 | 贴入链接 → 点击生成 → SSE 进度条实时跳动 |
| 0:50-1:30 | 结果展示 | 摘要 → 结构化文档 → 思维导图依次展开 |
| 1:30-2:00 | v3 亮点 | 双模型分屏对比，字幕："DeepSeek vs Qwen, pick the better one" |
| 2:00-2:40 | 技术底牌 | 架构图 + ArgoCD 部署界面 + 字幕："Self-hosted K8s, GitOps, local ASR — production-grade, solo-built" |
| 2:40-3:00 | 收尾 | 产品 URL + GitHub 链接，"Distill — turn any video into knowledge" |

---

*最后更新：2026年6月16日*
