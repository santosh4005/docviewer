# DocViewer

A lightweight web app that renders `.docx` Word documents in the browser, with an AI-powered chat panel for asking questions about each document.

## Quick Start

```bash
cp .env.example .env
# Edit .env and set your OPENROUTER_API_KEY

./scripts/start.sh          # Linux/macOS
# or
.\scripts\start.ps1         # Windows (PowerShell)
```

Open [http://localhost:8080](http://localhost:8080).

Drop `.docx` files into the `docs/` folder — they appear immediately (no restart needed).

## Requirements

- Docker
- An [OpenRouter](https://openrouter.ai) API key (for the AI chat feature)

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes (for chat) | — | OpenRouter API key |
| `DOCS_PATH` | No | `/app/docs` | Path inside the container to `.docx` files |

## Development

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8080
uv run pytest
```

### Frontend

```bash
cd frontend
npm install
npm start          # dev server at localhost:4200, proxies /api to localhost:8080
npm test           # unit tests (Vitest)
npm run test:integration   # integration tests (requires backend running)
```

### Docker

```bash
./scripts/start.sh --build   # rebuild image and start
./scripts/stop.sh            # stop and remove container

# or with Docker Compose
docker compose up --build
```

## Architecture

Single Docker container on port 8080. FastAPI serves both the Angular SPA and all `/api/*` routes.

```
frontend/   Angular SPA (TypeScript/SCSS)
backend/    FastAPI + uv (Python) — document parsing, AI chat, static file serving
docs/       Volume-mounted .docx files (source of truth, no database)
scripts/    start/stop helpers (bash + PowerShell)
```

The AI chat uses [LiteLLM](https://github.com/BerriAI/litellm) via OpenRouter with `google/gemini-2.5-flash-lite`. Document text is extracted server-side via [mammoth](https://github.com/mwilliamson/python-mammoth); the frontend never sends document content to the API.
