# DocViewer — Word Document Browser

## Project Specification

---

## Implementation Status

| Layer | Status | Notes |
|---|---|---|
| Backend — project scaffold | ✅ Done | `uv init`; dependencies: `fastapi`, `uvicorn[standard]`, `mammoth`, `litellm`, `python-multipart` |
| Backend — document routes | ✅ Done | `GET /api/documents`, `GET /api/documents/{filename}`, `GET /api/health` |
| Backend — chat route | ✅ Done | `POST /api/chat` with 404 / 422 / 503 error handling |
| Backend — mammoth converter | ✅ Done | HTML conversion (`convert_to_html`) + plain-text extraction (`extract_raw_text`) |
| Backend — AI chat | ✅ Done | LiteLLM → OpenRouter → `gemini-2.5-flash-lite`; Pydantic Structured Output |
| Backend — tests | ✅ Done | 10 tests, all passing (`uv run pytest`) |
| Frontend — Angular project | ✅ Done | Angular 21, standalone components, Angular Material 3 |
| Frontend — document-index | ✅ Done | Card grid, spinner, empty state, error state |
| Frontend — document-view | ✅ Done | Two-column layout, `DomSanitizer`, `::ng-deep` doc styles |
| Frontend — document-chat | ✅ Done | Bubble messages, typing indicator, mobile overlay |
| Frontend — services | ✅ Done | `DocumentService`, `ChatService`; `encodeURIComponent` for filenames |
| Frontend — unit tests | ✅ Done | 17 tests, all passing (`npm test`) |
| Frontend — integration tests | ✅ Done | 10 tests against real backend (`npm run test:integration`) |
| Docker / scripts | ⬜ Not started | |

### Backend Implementation Decisions

- **LiteLLM via OpenRouter** instead of any vendor SDK — `litellm.completion()` with `model="openrouter/google/gemini-2.5-flash-lite"` and `response_format=_ChatAnswer` (Pydantic Structured Output). Response is read from `.choices[0].message.parsed`; falls back to `model_validate_json(.content)` for models that return a JSON string.
- **`lifespan` context manager** used in `main.py` instead of the deprecated `@app.on_event("startup")`.
- **API key check in the route handler** (`chat.py`), not the service — 503 is raised before any file I/O or LLM call. `OPENROUTER_API_KEY` is the required env var; LiteLLM reads it automatically.
- **Static files mount is last** in `main.py` so `/api/*` routes always win over the Angular SPA catch-all.
- **Test isolation for empty-docs test** — uses `monkeypatch` + pytest's `tmp_path` to point `DOCS_PATH` at a throwaway directory instead of deleting files shared by the session-scoped `sample_docx` fixture.

### Frontend Implementation Decisions

- **Angular 21 with Vitest** — Angular CLI 21 configures Vitest by default (not Jest/Karma). All unit tests use `TestBed` + `HttpTestingController` via Vitest; no extra test runner configuration needed.
- **`encodeURIComponent(filename)`** called explicitly in `DocumentService.getDocument()` — filenames with spaces (e.g. `Annual Report.docx`) must be percent-encoded before embedding in the URL path. `HttpClient` does not encode path segments automatically.
- **`paramMap` observable instead of `snapshot`** in `DocumentViewComponent.ngOnInit()` — subscribing to the observable handles the case where Angular reuses the component instance across navigations between different `/doc/:filename` routes.
- **`ngOnChanges` in `DocumentChatComponent`** — clears `messages`, `inputValue`, and `isLoading` when `filename` input changes, so chat history never bleeds between documents if the component is reused.
- **`::ng-deep .doc-content { ... }`** in `document-view.component.scss` — required to style mammoth-generated HTML injected via `[innerHTML]`, since Angular's emulated encapsulation does not pierce into dynamically-inserted DOM nodes.
- **`changeOrigin: true`** in `src/proxy.conf.json` — prevents the dev-server proxy from forwarding the browser's `Host: localhost:4200` header to the backend, which would mismatch the backend's own host.
- **`of()` observables in unit tests** emit synchronously — component state is fully settled immediately after `send()`, so no `fakeAsync`/`tick()` or zone.js is needed. Tests that verify in-flight loading state check `comp.isLoading` directly rather than polling the DOM.
- **Integration tests use plain `fetch`** in a Node Vitest environment (`vitest.integration.config.ts`) — no Angular DI or TestBed needed; tests verify the API contract (status codes, response shapes, error codes) against the real FastAPI process.

---

## 1. Vision

DocViewer is a lightweight web application that reads a folder of `.docx` Word documents from disk and renders them beautifully in the browser. It preserves all key formatting — headings, tables, images, bold/italic text, and lists — so users can browse and read documents without needing Microsoft Word installed.

The app is packaged as a single Docker container. Users point the container at a `docs/` folder and immediately get a clean, navigable document library in their browser. An AI-powered chat panel lets users ask questions about whichever document they are currently reading.

---

## 2. User Experience

### First Launch

The user runs a single Docker command. A browser opens to `http://localhost:8000`. They immediately see:

- A home page listing all `.docx` documents found in the `docs/` folder
- Each document shown with its filename (and title if extractable from content)
- Clicking a document opens it in a full-page reading view
- A "← Back" link returns them to the index

### What the User Can Do

- **Browse the document index** — see all available `.docx` files at a glance
- **Open a document** — rendered as clean HTML in the browser, preserving all formatting
- **Read formatted content** — headings displayed hierarchically, tables as HTML tables, images inline, bold/italic/lists preserved
- **Navigate back** — return to the index without losing their place
- **Chat with the document** — ask questions in a side panel; the AI answers using only the content of the currently open document

### What the User Cannot Do (Out of Scope)

- Edit documents — read-only
- Search across documents — navigation only
- Upload new documents through the browser — add files to `docs/` on disk directly

### Visual Design

- Clean, minimal reading-focused layout
- Light theme — optimized for document readability
- Document view: two-column layout — document content on the left (~65% width), chat panel on the right (~35% width)
- Index page: card or list layout with document names
- Responsive — works on desktop and tablet; chat panel collapses to a toggle button on mobile

---

## 3. Architecture Overview

### Single Container, Single Port

```
┌─────────────────────────────────────────────────┐
│  Docker Container (port 8000)                   │
│                                                 │
│  FastAPI (Python/uv)                            │
│  ├── /api/documents        List all docs        │
│  ├── /api/documents/{name} Fetch rendered HTML  │
│  ├── /api/chat             AI Q&A for a doc     │
│  ├── /api/health           Health check         │
│  └── /*                    Angular static files │
│                                                 │
│  docs/ volume-mounted from host                 │
│  mammoth converts .docx → HTML on request       │
│  Anthropic Claude API answers document Q&A      │
└─────────────────────────────────────────────────┘
```

- **Frontend**: Angular (TypeScript), built as a static export, served by FastAPI (`frontend/`)
- **Backend**: FastAPI (Python), managed as a `uv` project (`backend/`)
- **Document conversion**: `mammoth` — converts `.docx` to clean, semantic HTML
- **AI chat**: LiteLLM via OpenRouter (`openrouter/google/gemini-2.5-flash-lite`) — answers user questions grounded in the current document's text using Structured Outputs
- **Storage**: No database — the `docs/` folder on disk is the source of truth

### Why These Choices

| Decision | Rationale |
|---|---|
| FastAPI over Django/Flask | Lightweight, async-capable, fast startup, excellent for serving static files + small API |
| mammoth over python-docx | Designed specifically for `.docx` → HTML; preserves semantic structure better than raw XML parsing |
| Angular | Chosen by the user; well-suited for a structured document browser SPA |
| LiteLLM + OpenRouter for chat | Provider-agnostic wrapper; OpenRouter gives access to Gemini 2.5 Flash Lite without vendor lock-in; Structured Outputs guarantee a parseable response |
| No database | Documents live on disk; no persistence layer needed for a read-only app |
| No search | Out of scope for v1; keeps the stack simple and the container small |
| Single container | One `docker run` command; no orchestration needed |

---

## 4. Directory Structure

```
docviewer/
├── frontend/                        # Angular project — ALL frontend code lives here
│   ├── src/
│   │   ├── app/
│   │   │   ├── document-index/      # Home page — list of all docs
│   │   │   │   ├── document-index.component.ts
│   │   │   │   ├── document-index.component.html
│   │   │   │   └── document-index.component.scss
│   │   │   ├── document-view/       # Full document reading view + chat panel
│   │   │   │   ├── document-view.component.ts
│   │   │   │   ├── document-view.component.html
│   │   │   │   └── document-view.component.scss
│   │   │   ├── document-chat/       # AI chat panel component
│   │   │   │   ├── document-chat.component.ts
│   │   │   │   ├── document-chat.component.html
│   │   │   │   └── document-chat.component.scss
│   │   │   ├── services/
│   │   │   │   ├── document.service.ts   # HTTP calls to /api/documents
│   │   │   │   └── chat.service.ts       # HTTP calls to /api/chat
│   │   │   ├── app.routes.ts
│   │   │   └── app.component.ts
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.prod.ts
│   │   └── styles.scss
│   ├── angular.json
│   └── package.json
│
├── backend/                         # FastAPI uv project — ALL backend code lives here
│   ├── pyproject.toml
│   ├── uv.lock
│   └── app/
│       ├── main.py                  # FastAPI app entry point; mounts static files
│       ├── routes/
│       │   ├── documents.py         # /api/documents endpoints
│       │   └── chat.py              # /api/chat endpoint
│       └── services/
│           ├── converter.py         # mammoth .docx → HTML / plain-text logic
│           └── ai_chat.py           # Anthropic Claude API integration
│
├── docs/                            # Word documents (volume-mounted at runtime)
│   └── .gitkeep
│
├── scripts/
│   ├── start.sh
│   ├── stop.sh
│   ├── start.ps1
│   └── stop.ps1
│
├── Dockerfile                       # Multi-stage: Node (Angular build) → Python (FastAPI)
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

### Key Boundaries

- **`frontend/`** is a self-contained Angular project. It talks to the backend only via `/api/*` endpoints. All TypeScript, HTML, SCSS, and Angular configuration stays inside `frontend/`. Angular's build output is copied into the Docker image and served as static files by FastAPI.
- **`backend/`** is a self-contained uv project. It owns document scanning, conversion, AI chat, and file serving. No TypeScript or frontend tooling belongs here.
- **`docs/`** at the project root is the volume mount point. `.docx` files dropped here are automatically discovered. The directory is in the repo (via `.gitkeep`) but actual documents are gitignored.
- **`scripts/`** contains idempotent start/stop helpers — safe to run multiple times.

---

## 5. Environment Variables

```bash
# Path inside the container where .docx files are read from
DOCS_PATH=/app/docs

# OpenRouter API key — required for the AI chat feature
OPENROUTER_API_KEY=sk-or-...
```

`DOCS_PATH` defaults to `/app/docs`. `OPENROUTER_API_KEY` must be set; the app logs a warning at startup if it is missing and returns a 503 from `/api/chat` until it is provided. The model is fixed to `openrouter/google/gemini-2.5-flash-lite` and is not configurable via environment variable.

---

## 6. Document Processing

### Conversion Pipeline

When a document is requested, the backend:

1. Looks up the `.docx` file in `DOCS_PATH` by filename
2. Passes the file to `mammoth.convert_to_html()`
3. Returns the resulting HTML string to the frontend
4. The Angular component renders it using `[innerHTML]` with appropriate sanitization

Conversion is **on-demand** (not pre-processed at startup). For small-to-medium document collections this is fast enough; mammoth converts typical documents in under 100ms.

### Plain-Text Extraction (for AI Chat)

The chat service extracts plain text from the `.docx` file using `mammoth.extract_raw_text()`. This stripped text is passed to the Claude API as document context. Using plain text rather than HTML keeps the prompt compact and avoids leaking markup tokens into the model's context window.

### What mammoth Preserves

| Element | Output |
|---|---|
| Heading 1 / 2 / 3 | `<h1>`, `<h2>`, `<h3>` |
| Bold | `<strong>` |
| Italic | `<em>` |
| Bullet lists | `<ul><li>` |
| Numbered lists | `<ol><li>` |
| Tables | `<table><tr><td>` |
| Embedded images | Base64-encoded `<img>` tags inline |
| Paragraph breaks | `<p>` |

### Document Discovery

The `/api/documents` endpoint scans `DOCS_PATH` for all files matching `*.docx` (case-insensitive). It returns a sorted list of filenames. No recursive subdirectory scanning in v1 — all docs must be in the flat `docs/` folder.

### Edge Cases

- **File not found**: return HTTP 404
- **Corrupt or unreadable `.docx`**: catch mammoth exceptions, return HTTP 422 with an error message
- **Empty docs folder**: return an empty list — the frontend shows a friendly "No documents found" message
- **Large images**: mammoth embeds them as base64; no size limit in v1

---

## 7. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List all available `.docx` files (filename + display name) |
| GET | `/api/documents/{filename}` | Fetch the HTML-rendered content of a single document |
| POST | `/api/chat` | Ask an AI question about a specific document |
| GET | `/api/health` | Health check — returns `{"status": "ok"}` |

### Response Shapes

**`GET /api/documents`**
```json
[
  { "filename": "Annual Report 2024.docx", "display_name": "Annual Report 2024" },
  { "filename": "User Guide.docx", "display_name": "User Guide" }
]
```

**`GET /api/documents/{filename}`**
```json
{
  "filename": "User Guide.docx",
  "display_name": "User Guide",
  "html": "<h1>User Guide</h1><p>...</p>"
}
```

**`POST /api/chat`** — request body:
```json
{
  "filename": "User Guide.docx",
  "question": "What are the system requirements?"
}
```

**`POST /api/chat`** — response:
```json
{
  "answer": "According to the User Guide, the minimum system requirements are..."
}
```

Error responses from `/api/chat`:
- `404` — document not found
- `422` — document could not be parsed
- `503` — `ANTHROPIC_API_KEY` not configured

`display_name` strips the `.docx` extension. Filenames are URL-encoded when used as path parameters.

---

## 8. Frontend Design

All frontend code lives in `frontend/src/app/`.

### Pages / Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `DocumentIndexComponent` | Home page — grid/list of all documents |
| `/doc/:filename` | `DocumentViewComponent` | Full document reading view + embedded chat panel |

### Document Index Page (`frontend/src/app/document-index/`)

- Fetches `GET /api/documents` on load
- Renders a card or row for each document with its display name
- Each card links to `/doc/:filename`
- Shows "No documents found. Add .docx files to the docs/ folder." when the list is empty
- Loading spinner while fetching

### Document View Page (`frontend/src/app/document-view/`)

- Fetches `GET /api/documents/:filename` on load
- Renders returned HTML using Angular's `[innerHTML]` binding
- Applies scoped CSS to style the HTML (headings, tables, images, lists)
- "← Back to Documents" link at the top
- Shows an error message if the document cannot be loaded
- Embeds the `DocumentChatComponent` in a right-hand panel, passing the current `filename` as an `@Input()`

### AI Chat Panel (`frontend/src/app/document-chat/`)

- Displayed to the right of the document content in a fixed-width panel (~35%)
- Header: "Ask about this document"
- Message history rendered as a scrollable list (user messages right-aligned, AI responses left-aligned)
- Text input + "Send" button at the bottom of the panel
- On send: calls `ChatService.ask(filename, question)` → `POST /api/chat`
- Shows a typing indicator (animated dots) while awaiting a response
- Disables input while a request is in flight (prevents double-sends)
- Error state: "Sorry, I couldn't answer that question. Please try again." — user can retry
- Chat history is scoped to the current document view; navigating away clears it
- On mobile (< 768 px): panel collapses behind a "Chat" toggle button in the header

### Angular Services (`frontend/src/app/services/`)

**`document.service.ts`**
- `listDocuments(): Observable<DocumentSummary[]>` — GET /api/documents
- `getDocument(filename: string): Observable<DocumentDetail>` — GET /api/documents/{filename}

**`chat.service.ts`**
- `ask(filename: string, question: string): Observable<ChatResponse>` — POST /api/chat

### Styling Notes

- Use Angular's component-scoped styles for the document view so rendered HTML inherits appropriate typography
- Table CSS: full-width, bordered cells, alternating row shading
- Images: `max-width: 100%` to prevent overflow
- Heading hierarchy: clear size differentiation (h1 > h2 > h3)
- `DomSanitizer.bypassSecurityTrustHtml()` required to render backend HTML — HTML comes from your own backend, not user input

---

## 9. AI Chat Feature

### AI Design

Use LiteLLM via OpenRouter to call the `openrouter/google/gemini-2.5-flash-lite` model. Use Structured Outputs (`response_format` with a Pydantic model) so the response is always machine-parseable.

### How It Works

1. The user opens a document — the chat panel initialises with the document filename.
2. The user types a question and presses Send.
3. The Angular `ChatService` posts `{ filename, question }` to `POST /api/chat`.
4. The backend `chat.py` route:
   a. Resolves the `.docx` file path from `DOCS_PATH`.
   b. Calls `converter.extract_text(filename)` to get plain text via `mammoth.extract_raw_text()`.
   c. Calls `ai_chat.answer(document_text, question)`.
5. `ai_chat.py` calls `litellm.completion()` with `response_format=_ChatAnswer` (Structured Output) and a system prompt that grounds the model strictly in the document content.
6. The response is returned to the frontend and appended to the chat history.

### System Prompt Design (`backend/app/services/ai_chat.py`)

```
You are a helpful assistant that answers questions about a specific document.
You must answer using only information found in the document provided below.
If the answer is not in the document, say: "I couldn't find that information in this document."
Do not speculate or add information from outside the document.

--- DOCUMENT START ---
{document_text}
--- DOCUMENT END ---
```

### LiteLLM API Call (`backend/app/services/ai_chat.py`)

- Uses the `litellm` Python SDK
- Model: `openrouter/google/gemini-2.5-flash-lite` (fixed constant, not env-configurable)
- `response_format=_ChatAnswer` — Pydantic Structured Output; response is parsed via `.choices[0].message.parsed`, with a fallback to `model_validate_json(.content)` for models that return a JSON string instead
- `max_tokens`: 1024 — sufficient for typical document Q&A answers
- No streaming in v1 — wait for the full response before returning

### Backend File: `backend/app/routes/chat.py`

```python
# POST /api/chat
# Request:  { filename: str, question: str }
# Response: { answer: str }
# Errors:   404 (not found), 422 (parse error), 503 (no API key)
```

### Backend File: `backend/app/services/ai_chat.py`

```python
# answer(document_text: str, question: str) -> str
# Calls Anthropic Claude API with document context + user question
# Returns the model's text response
```

### Security Notes

- The document text is injected into the system prompt server-side. The frontend never sends raw document text to the API.
- `OPENROUTER_API_KEY` is read from environment variables only — never hardcoded or exposed to the frontend.
- User questions are passed as `user` messages, not injected into the system prompt, to prevent prompt injection.

---

## 10. Docker & Deployment

### Multi-Stage Dockerfile

```
Stage 1: Node 20 slim
  - Copy frontend/
  - npm install && ng build (produces dist/ output)

Stage 2: Python 3.12 slim
  - Install uv
  - Copy backend/
  - uv sync (install Python dependencies from lockfile)
  - Copy frontend dist/ into backend/static/
  - Copy docs/ placeholder
  - Expose port 8000
  - CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

FastAPI serves the Angular static files at `/` and all API routes at `/api/*` on port 8000.

### Volume Mount

The `docs/` folder is mounted into the container at runtime:

```bash
docker run -v /path/to/your/docs:/app/docs \
           -e OPENROUTER_API_KEY=sk-or-... \
           -p 8000:8000 docviewer
```

The start script handles the volume and port mapping automatically.

### Start/Stop Scripts

**`scripts/start.sh`** (macOS/Linux):
- Builds the Docker image if not already built (or if `--build` flag passed)
- Runs the container with the volume mount, port mapping, and `OPENROUTER_API_KEY` from the host environment
- Prints `App running at http://localhost:8000`

**`scripts/stop.sh`** (macOS/Linux):
- Stops and removes the running container

**`scripts/start.ps1`** / **`scripts/stop.ps1`**: PowerShell equivalents for Windows.

All scripts are idempotent — safe to run multiple times.

---

## 11. Testing Strategy

### Backend (pytest) — lives in `backend/`

- **Document discovery**: scanner returns correct list from a test `docs/` fixture folder; handles empty folder; ignores non-`.docx` files
- **Conversion**: mammoth converts a known `.docx` fixture and output contains expected HTML elements
- **API routes — documents**: correct status codes for valid doc, missing doc, empty docs folder; response shape matches schema
- **API routes — chat**: 
  - Returns 200 with `answer` field when `ANTHROPIC_API_KEY` is set and document exists
  - Returns 404 for unknown filename
  - Returns 503 when `OPENROUTER_API_KEY` is missing
  - Mocks `litellm.completion` so tests do not make real API calls
- **`ai_chat.py`**: system prompt contains document text; question is in the user message; `response_format` is set to the Pydantic model
- **Edge cases**: corrupt file returns 422; filename with spaces handled correctly

### Frontend (Jest + Angular Testing Library) — lives in `frontend/`

- **DocumentIndexComponent**: renders document cards from mock API response; shows empty state; shows loading spinner
- **DocumentViewComponent**: renders HTML content from mock API; shows error state on failed fetch; "Back" link navigates to index; passes correct filename to `DocumentChatComponent`
- **DocumentChatComponent**:
  - Renders user messages and AI responses in the correct positions
  - Shows typing indicator while request is in flight
  - Disables input during a pending request
  - Clears history when the component is destroyed
  - Shows error message on failed chat request
- **ChatService**: sends correct POST body; maps response to `ChatResponse`
- **Routing**: navigating to `/doc/Test.docx` triggers the correct API call

### E2E (Playwright or Cypress — optional for v1)

- Fresh start: docs folder with 2 sample files → index shows 2 documents
- Click a document → view renders with visible heading text + chat panel is visible
- Type a question in the chat panel → answer appears in the chat history
- Back button → returns to index; chat history is cleared
