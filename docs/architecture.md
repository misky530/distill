# Distill — Architecture

## v3 Application Architecture (built during hackathon)

```
Browser
  │  SSE (progress + streaming results)
  ▼
Next.js 15 (App Router)
  │
  ├── /api/transcribe   → BullMQ job enqueue
  ├── /api/progress     → Redis pub/sub → SSE push
  └── /api/generate     → LLM Router
                              │
                    ┌─────────┴─────────┐
                 DeepSeek             Qwen
                    └─────────┬─────────┘
                           Doubao
                          (Judge)
                              │
                         Winner + scores
```

## v2 Infrastructure (pre-existing, described for context)

The application runs on a self-hosted 3-node Kubernetes cluster with no public IP.
Public access is achieved via:

```
Internet
  │
  ▼
Alibaba Cloud ECS (public IP)
  │  nginx reverse proxy
  ▼
frp tunnel (内网穿透)
  │
  ▼
K8s NodePort (home lab cluster)
  │
  ▼
Pod (Next.js / n8n / SenseVoice)
```

### GitOps delivery pipeline

```
git push
  │
  ▼
GitLab CI
  │  build & push image
  ▼
Private GitLab Registry
  │
  ▼
ArgoCD (auto-sync)
  │
  ▼
K8s Deployment (rolling update)
```

Every commit to `main` auto-deploys to production — no manual `kubectl apply`.

## Async task pipeline (v3)

Long videos (60min+) would time out on synchronous HTTP.
The v3 solution:

```
POST /api/transcribe
  │  enqueue job
  ▼
BullMQ (Redis-backed queue)
  │
  ▼
Worker: transcribe/src
  │  SenseVoice ASR (self-hosted)
  │  publish progress events
  ▼
Redis pub/sub
  │
  ▼
GET /api/progress  (SSE)
  │
  ▼
Browser progress bar
```

## Tech stack summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript |
| ORM | Drizzle ORM + PostgreSQL (pgvector) |
| Queue | BullMQ + Redis |
| LLM Router | Custom service (DeepSeek / Qwen / Doubao) |
| ASR | SenseVoice (self-hosted) |
| Infra | Kubernetes (3-node), ArgoCD, GitLab CI |
| Ingress | nginx + frp (no public IP solution) |
| Observability | Structured JSON logs → Loki + Grafana (roadmap) |
