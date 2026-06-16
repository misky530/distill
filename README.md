# Distill — Turn Any Video into Knowledge

> 🏆 Submitted to [FutureAI Global Hackathon 2026](https://devpost.com)

**Paste a video link, get structured knowledge.** Distill transcribes Bilibili/Douyin videos and uses multiple LLMs in parallel to generate summaries, structured study documents, and mind maps — then lets an independent judge model pick the best output.

🌐 **Live at [wd-ai.cloud](https://wd-ai.cloud)**

---

## The Problem

China's 200M+ exam-prep students (考研/考公) routinely face 3-hour lecture videos on Bilibili and Douyin. Tools like NotebookLM serve YouTube and English content — this audience has nothing equivalent. Watching at 2× speed still leaves zero reviewable notes.

## Demo

<!-- Replace with actual GIF after recording -->
![Demo GIF](docs/images/demo.gif)

| Feature | Description |
|---|---|
| 🎙️ Transcription | Self-hosted SenseVoice ASR (better Chinese accuracy, lower cost than cloud ASR) |
| 📝 Summary | Adaptive-structure LLM summary (no rigid template that degrades quality) |
| 📄 Document | Structured study notes ready for review |
| 🧠 Mind map | Mermaid-rendered tree diagram |
| ⚡ Multi-model | DeepSeek + Qwen generate in parallel; Doubao judges and picks the winner |
| 📡 Live progress | SSE streams real-time status for long videos |

## What's new in this hackathon (v3)

The following were built during the FutureAI Global Hackathon 2026:

- **LLM Router** (`services/llm-router/`) — custom service replacing n8n orchestration; supports parallel multi-model generation, per-plan routing, and SSE streaming
- **LLM-as-judge** — Doubao evaluates DeepSeek vs Qwen outputs on coverage, structure, and factuality; winner auto-selected with scores shown to user
- **Async task pipeline** — BullMQ + Redis queue with pub/sub progress events, eliminating timeouts on 1h+ videos
- **Next.js 15 frontend** — App Router rewrite with TypeScript, Drizzle ORM, PostgreSQL

Pre-existing foundation (v2, in production before the hackathon): self-hosted 3-node K8s cluster, GitOps pipeline (GitLab CI → ArgoCD), frp ingress, SenseVoice ASR. See [docs/architecture.md](docs/architecture.md).

## Architecture

```
Browser ──SSE──► Next.js 15
                    │
              LLM Router
              ├── DeepSeek ──┐
              └── Qwen ──────┴──► Doubao (Judge) ──► Winner
                    │
              BullMQ Worker ──► SenseVoice ASR
```

Full diagram: [docs/architecture.md](docs/architecture.md)

## Quick start (local)

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/distill.git
cd distill

# 2. Start Postgres + Redis
docker compose up -d

# 3. Configure environment
cp .env.example .env
# fill in your API keys

# 4. Install & run
pnpm install
pnpm --filter web dev
pnpm --filter llm-router dev
```

## Tech highlights

| What | Why it matters |
|---|---|
| Self-hosted SenseVoice ASR | No per-minute cloud cost; better Chinese accuracy; user data stays local |
| LLM-as-judge (Doubao) | Third-party judge avoids self-preference bias; scoring is transparent to the user |
| BullMQ async pipeline | Handles 1h+ videos without HTTP timeout; progress streamed via SSE |
| K8s + ArgoCD GitOps | Every commit auto-deploys; zero-downtime rolling updates |
| pgvector semantic cache (roadmap) | SHA256 exact cache + cosine similarity cache to cut LLM costs ~40% |

## Roadmap

- [ ] Two-tier LLM caching (Redis exact + pgvector semantic)
- [ ] Observability: Loki + Grafana + distributed tracing
- [ ] WeChat Mini Program login for Chinese market
- [ ] Pluggable judge model (swap Doubao → Claude via one config change)

## License

MIT — see [LICENSE](LICENSE)
