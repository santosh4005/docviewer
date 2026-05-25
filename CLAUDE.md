# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This project is in the **planning stage**. The full specification lives in `planning/PLAN.md`. No implementation files exist yet. When implementing, follow the directory structure and boundaries in that plan exactly.

## Architecture

Single Docker container exposing port 8000. FastAPI serves both the Angular SPA (static files) and all `/api/*` routes from the same port.

```
frontend/   ← Angular SPA (TypeScript/SCSS) — build output served by FastAPI
backend/    ← FastAPI + uv (Python) — document parsing, AI chat, static file serving
docs/       ← volume-mounted .docx files (source of truth, no database)
scripts/    ← start/stop helpers (bash + PowerShell)
```

**Strict boundary**: frontend talks to backend only via `/api/*`. No Python in `frontend/`, no TypeScript in `backend/`.

### Backend (`backend/`)

- Entry point: `backend/app/main.py` — FastAPI app, mounts Angular static files at `/`
- `backend/app/routes/documents.py` — `GET /api/documents`, `GET /api/documents/{filename}`
- `backend/app/routes/chat.py` — `POST /api/chat`
- `backend/app/services/converter.py` — wraps `mammoth` for `.docx` → HTML and plain-text extraction
- `backend/app/services/ai_chat.py` — calls Anthropic Claude API; document text goes in the system prompt with `cache_control: ephemeral`; user question goes in the `user` turn (never in the system prompt)

### Frontend (`frontend/`)

- `document-index/` — lists all docs via `GET /api/documents`
- `document-view/` — renders document HTML via `[innerHTML]` + `DomSanitizer.bypassSecurityTrustHtml()`; hosts the chat panel
- `document-chat/` — AI chat panel `@Input() filename`; calls `ChatService.ask()`; scoped to current document view
- `services/document.service.ts` and `services/chat.service.ts` — all HTTP calls

## Commands

### Backend

```bash
cd backend
uv sync                          # install dependencies
uv run uvicorn app.main:app --reload --port 8000   # dev server
uv run pytest                    # all tests
uv run pytest tests/test_chat.py # single test file
```

### Frontend

```bash
cd frontend
npm install
npm start                        # ng serve (proxies /api to localhost:8000)
npm test                         # Jest unit tests
npm run test -- --testPathPattern=document-chat   # single spec
npm run build                    # production build → dist/
```

### Docker

```bash
# Build and run (requires ANTHROPIC_API_KEY in environment)
./scripts/start.sh

# Stop
./scripts/stop.sh

# Manual build+run
docker build -t docviewer .
docker run -v $(pwd)/docs:/app/docs -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY -p 8000:8000 docviewer
```

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DOCS_PATH` | No | `/app/docs` | Path inside container to `.docx` files |
| `ANTHROPIC_API_KEY` | Yes (for chat) | — | Anthropic API key; app returns 503 from `/api/chat` if missing |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-6` | Claude model for document Q&A |

## Key Implementation Notes

- **Document conversion is on-demand**, not cached at startup. mammoth handles a typical doc in < 100 ms.
- **AI chat uses plain text** (`mammoth.extract_raw_text()`), not HTML, to keep the prompt compact.
- **Prompt caching**: apply `cache_control: {"type": "ephemeral"}` to the document text block in the system prompt so repeated questions about the same doc hit the Anthropic cache.
- **`/api/chat` security**: `ANTHROPIC_API_KEY` is server-side only. The frontend never sends raw document text — only `{ filename, question }`.
- **Dockerfile is multi-stage**: Stage 1 = Node 20 (Angular build); Stage 2 = Python 3.12 (copies `dist/` into `backend/static/`).

## CI / GitHub Actions

- `.github/workflows/claude.yml` — Claude PR assistant; triggered by `@claude` mentions in issues and PR comments/reviews.
- `.github/workflows/claude-code-review.yml` — automatic Claude code review on every PR open/sync/reopen. Requires `CLAUDE_CODE_OAUTH_TOKEN` secret.
