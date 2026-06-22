# Distill — Turn Any Video into Knowledge

> 🏆 Built for [FutureAI Global Hackathon 2026](https://devpost.com)

**Paste a video link, get structured knowledge.** Distill transcribes Bilibili videos and uses multiple LLMs in parallel to generate summaries, structured study documents, and mind maps — then lets an independent judge model pick the best output.

🌐 **Live at [wd-ai.cloud](https://wd-ai.cloud)**

---

## The Problem

China's 200M+ exam-prep students (考研/考公) routinely face 3-hour lecture videos on Bilibili and Douyin. Tools like NotebookLM serve YouTube and English content — this audience has nothing equivalent. Watching at 2× speed still leaves zero reviewable notes.

## Demo

<!-- Replace with actual GIF after recording -->
![Demo GIF](docs/images/demo.gif)

| Feature | Description |
|---|---|
| 🎙️ Transcription | Bilibili video → audio (yt-dlp) → cloud ASR (SiliconFlow / SenseVoiceSmall) |
| 📝 Summary | Adaptive-structure LLM summary (no rigid template that degrades quality) |
| 📄 Document | Structured study notes ready for review |
| 🧠 Mind map | Mermaid-rendered tree diagram |
| ⚡ Multi-model | DeepSeek-v4-pro + Kimi-k2.6 generate in parallel; Doubao-seed-2.0-pro judges and picks the winner |

## What's new in this hackathon (v3)

The following were built during the FutureAI Global Hackathon 2026:

- **End-to-end Bilibili ingestion** — paste a video URL, `/api/transcribe` downloads the audio via yt-dlp and transcribes it through SiliconFlow's cloud ASR, with duration validation + automatic retry to catch a CDN edge case where downloads silently truncate (see [docs/EXPERIENCE.md](docs/EXPERIENCE.md))
- **LLM-as-judge** — DeepSeek-v4-pro and Kimi-k2.6 generate in parallel on the same transcript; Doubao-seed-2.0-pro evaluates both on coverage, structure, and factuality and picks a winner, with scores shown to the user
- **Next.js 15 frontend** — App Router rewrite with TypeScript, supporting both direct-text input and Bilibili-URL ingestion in one interface

All three models are accessed through a single unified gateway (Volcano Ark coding plan), differentiated only by model parameter.

## Deployment

Runs on a single server via `docker compose up -d`. Simple by design — the focus this hackathon was the product, not the ops.

## Architecture

```
Browser
  │  HTTP (synchronous request, no SSE yet)
  ▼
Next.js 15 (App Router)
  │
  ├── /api/transcribe → yt-dlp → SiliconFlow ASR → transcript
  │
  └── /api/generate   → LLM Router (embedded in apps/web/lib/)
                              │
                    ┌─────────┴─────────┐
              DeepSeek-v4-pro      Kimi-k2.6
                    └─────────┬─────────┘
                      Doubao-seed-2.0-pro (Judge)
                              │
                         Winner + scores
```

Full diagram: [docs/architecture.md](docs/architecture.md)

## Quick start (local)

```bash
# 1. Clone
git clone https://github.com/misky530/distill.git
cd distill

# 2. Configure environment
cp .env.example .env.local
# fill in DEEPSEEK/KIMI/DOUBAO keys (Volcano Ark), SiliconFlow key,
# BILIBILI_COOKIES_PATH, YT_DLP_PATH, FFMPEG_PATH

# 3. Install & run
pnpm install
pnpm --filter web dev
```

> No database or queue service is required to run the current feature set — Postgres/Redis/BullMQ are part of the roadmap, not yet wired into the request path.

## Tech highlights

| What | Why it matters |
|---|---|
| LLM-as-judge (Doubao) | Third-party judge avoids self-preference bias; scoring is transparent to the user |
| Download-then-verify ASR pipeline | ffprobe duration check + strategy-switching retry catches a CDN edge case where "exit code 0" doesn't mean "correct data" |
| Embedded LLM Router | Single consumer (the Next.js app) today, so orchestration logic lives in `apps/web/lib/` rather than a separate deployed service — avoids unnecessary network hops and process management for v3 |

## Known limitations

- Bilibili only — Douyin URL validation exists in code but the download/transcription path is untested.
- Processing is synchronous HTTP; long videos (30min+) may hit request timeouts. Async queueing is on the roadmap, not yet implemented.
- Requires a manually exported Bilibili cookie file (no auto-refresh); see [docs/EXPERIENCE.md](docs/EXPERIENCE.md) for why `--cookies-from-browser` doesn't work on Windows.

## Roadmap

- [ ] Async task pipeline (BullMQ + Redis) with SSE progress streaming, to support 1h+ videos
- [ ] Two-tier LLM caching (Redis exact + pgvector semantic)
- [ ] Douyin ingestion support
- [ ] Observability: Loki + Grafana + distributed tracing
- [ ] WeChat Mini Program login for Chinese market
- [ ] Migrate LLM orchestration into n8n for visual workflow editing
- [ ] Pluggable judge model (swap Doubao → Claude via one config change)

## License

MIT — see [LICENSE](LICENSE)
