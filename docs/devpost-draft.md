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
Paste a video link, get structured knowledge: AI transcribes, summarizes, and generates mind maps in minutes. Built for students drowning in 3-hour lectures. Two LLMs compete, a third judges — live in production.
```

---

## 3. About the Project（正文 Markdown，粘贴进 Devpost 大文本框）

## Inspiration

Exam-prep students in China routinely face 3-hour lecture videos on Bilibili and Douyin. Tools like NotebookLM serve YouTube and English content — China's 200M+ exam-prep learners have nothing equivalent. Watching at 2x speed still wastes time, and nothing gets retained as reviewable notes. I built Distill to turn passive video watching into structured, reusable knowledge assets — transcripts, summaries, documents, and mind maps.

## What it does

Paste a Bilibili video link, or just paste raw text directly, and Distill:

1. **Downloads and transcribes** the video audio automatically (Bilibili ingestion built this hackathon)
2. **Generates** an adaptive-structure summary and a structured study document via LLM
3. **Renders** a Mermaid mind map for visual review
4. **Compares multiple LLMs side by side** — two models generate in parallel; an independent judge model evaluates both and picks the better output, with scores shown to the user

The product is live at https://wd-ai.cloud.

## How we built it

- A **multi-model LLM orchestration layer**: DeepSeek and Kimi generate in parallel on the same transcript, with Doubao acting as an independent judge that scores both outputs on coverage, structure, and factuality before picking a winner
- **End-to-end Bilibili ingestion pipeline**: paste a video URL, and the system downloads the audio (yt-dlp), transcribes it via a cloud ASR API (SiliconFlow, running the SenseVoiceSmall model), and feeds the transcript straight into the LLM router — no manual transcript copy-pasting required
- A **Next.js 15 (App Router)** frontend with TypeScript, covering both direct-text input and URL-based ingestion in a single interface
- All three models run through a single unified gateway (Volcano Ark), differentiated only by model parameter — simplifying key management for a solo-maintained project
- Deployed on a dedicated server via Docker Compose

## Challenges we ran into

- **Silent data corruption from an unstable CDN edge**: our video-to-audio pipeline would occasionally report a successful download — correct exit code, plausible file size — while the actual audio was a truncated 5-second stub instead of the full lecture. The failure mode wasn't a crash; it was confidently wrong data. We added a post-download duration check (via ffprobe) with an automatic retry that deliberately switches download strategy on each attempt, plus explicit cache invalidation so retries don't just re-serve the same bad file. The bigger lesson: "the process exited 0" is not the same guarantee as "the data is correct," and any pipeline ingesting third-party media needs a validation step that's independent of the tool's own success signal.
- **Mermaid rendering reliability**: LLMs love generating invalid graph syntax. Constraining output to a strict tree structure dramatically reduced render failures.
- **Prompt structure vs. content diversity**: forcing a fixed What/Why/How template degraded quality on general-purpose videos; we switched to adaptive structuring based on content type.

## What we learned

Shipping an AI product solo means the bottleneck is rarely the model — it's orchestration, output reliability, and the unglamorous edges of third-party integrations. The hardest bugs weren't in our own logic; they were in trusting that an external system (a CDN, a download tool's caching behavior) did what it claimed. Building defensively — validating outputs instead of just trusting exit codes — turned out to matter more than getting the LLM prompts exactly right on the first try. Prompt engineering is empirical: measure, don't assume.

## What's next

- Asynchronous processing with progress streaming (the current pipeline is synchronous HTTP, which works for short clips but won't scale to hour-long lectures without queuing)
- Two-tier LLM caching (exact-match + semantic cache) to cut inference costs
- Observability stack: structured logs → metrics → distributed tracing
- WeChat Mini Program login for the Chinese market
- Migrating the LLM orchestration logic into a visual workflow engine (n8n) for easier extensibility

---

## 4. Built With 标签（逗号分隔，填入 Devpost 标签框）
```
nextjs, typescript, deepseek, siliconflow, mermaid, yt-dlp
```

---

## 5. Try it out 链接
- 线上产品：https://wd-ai.cloud
- GitHub 仓库：https://github.com/misky530/distill

---

## 6. 待办事项（提交前必须完成）
- [x] GitHub 仓库建好后替换第5条链接
- [x] 确认 hackathon 期间新增的 transcribe/generate 功能已部署到 wd-ai.cloud 生产环境并验证可用
- [ ] 录制 demo 视频上传 YouTube，填入 Video demo link
- [ ] 上传产品截图到 Image gallery（思维导图页、双模型对比页、文档输出页）
- [ ] 确保 wd-ai.cloud 首页有英文入口，评委无需注册可体验 demo
- [ ] 7月3日前完成首次提交（留48小时缓冲）

---

## 7. Demo 视频分镜脚本（3分钟，待根据实际功能调整）

| 时间 | 画面 | 内容 |
|---|---|---|
| 0:00-0:20 | 痛点场景 | B站3小时考研课程页面，字幕："3-hour lectures. Zero notes. Sound familiar?" |
| 0:20-0:50 | 核心流程 | 贴入B站链接 → 点击生成知识 → 显示转录文本 |
| 0:50-1:30 | 结果展示 | 摘要 → 结构化文档 → 思维导图依次展开 |
| 1:30-2:10 | v3 亮点 | 双模型对比评分展示，字幕："Two models compete, an independent judge picks the winner" |
| 2:10-2:40 | 产品深挖 | 切换文本输入模式 / 不同视频类型的自适应摘要结构，字幕："Built solo: multi-LLM orchestration + a CDN edge case most teams would miss" |
| 2:40-3:00 | 收尾 | 产品 URL + GitHub 链接，"Distill — turn any video into knowledge" |

---

*最后更新：2026年6月22日*
