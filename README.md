# B站 AI 视频课代表

A self-hosted tool that fetches Bilibili video subtitles and uses an AI model (DeepSeek or any OpenAI-compatible API) to generate structured summaries. Supports multi-turn follow-up Q&A, session history, and clickable timestamps.

## Features

- Paste any Bilibili URL (full link, BV ID, or b23.tv short link)
- Four summary modes: detailed outline, brief outline, summary, Q&A questions
- Clickable timestamps that jump to the exact moment in the video
- Multi-turn chat grounded in the video's actual subtitles
- Session history persisted in SQLite — sessions survive restarts
- Subtitle caching via Upstash Redis (7-day TTL; optional)

## Self-hosting

### Prerequisites

- Docker + Docker Compose
- A DeepSeek API key (or any OpenAI-compatible endpoint)
- _(Optional)_ Upstash Redis for subtitle caching
- _(Optional)_ Bilibili `SESSDATA` cookie for restricted videos

### 1. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_API_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Optional: subtitle cache (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional: access restricted Bilibili videos
BILIBILI_SESSION_TOKEN=   # value of SESSDATA cookie from bilibili.com
```

### 2. Run

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

Session data is stored in `./data/chat.db` and persisted via a Docker volume.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (`better-sqlite3`) |
| Cache | Upstash Redis (optional) |
| Deploy | Docker + docker-compose |
