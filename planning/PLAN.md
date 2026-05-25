# DocViewer — Word Document Browser

## Project Specification

---

## 1. Vision

DocViewer is a lightweight web application that reads a folder of `.docx` Word documents from disk and renders them beautifully in the browser. It preserves all key formatting — headings, tables, images, bold/italic text, and lists — so users can browse and read documents without needing Microsoft Word installed.

The app is packaged as a single Docker container. Users point the container at a `docs/` folder and immediately get a clean, navigable document library in their browser.

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

### What the User Cannot Do (Out of Scope)

- Edit documents — read-only
- Search across documents — navigation only
- Upload new documents through the browser — add files to `docs/` on disk directly

### Visual Design

- Clean, minimal reading-focused layout
- Light theme — optimized for document readability
- Left-aligned document content with comfortable max-width (e.g. ~800px) and generous padding
- Index page: card or list layout with document names
- Responsive — works on desktop and tablet

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
│  └── /*                    Angular static files │
│                                                 │
│  docs/ volume-mounted from host                 │
│  mammoth converts .docx → HTML on request       │
└─────────────────────────────────────────────────┘
```

- **Frontend**: Angular (TypeScript), built as a static export, served by FastAPI
- **Backend**: FastAPI (Python), managed as a `uv` project
- **Document conversion**: `mammoth` — converts `.docx` to clean, semantic HTML
- **Storage**: No database — the `docs/` folder on disk is the source of truth

### Why These Choices

| Decision | Rationale |
|---|---|
| FastAPI over Django/Flask | Lightweight, async-capable, fast startup, excellent for serving static files + small API |
| mammoth over python-docx | Designed specifically for `.docx` → HTML; preserves semantic structure better than raw XML parsing |
| Angular | Chosen by the user; well-suited for a structured document browser SPA |
| No database | Documents live on disk; no persistence layer needed for a read-only app |
| No search | Out of scope for v1; keeps the stack simple and the container small |
| Single container | One `docker run` command; no orchestration needed |

---

## 4. Directory Structure

```
docviewer/
├── frontend/                  # Angular project
│   ├── src/
│   │   ├── app/
│   │   │   ├── document-index/   # Home page — list of all docs
│   │   │   └── document-view/    # Full document reading view
│   │   └── ...
│   ├── angular.json
│   └── package.json
├── backend/                   # FastAPI uv project
│   ├── pyproject.toml
│   ├── uv.lock
│   └── app/
│       ├── main.py            # FastAPI app entry point
│       ├── routes/
│       │   └── documents.py   # /api/documents endpoints
│       └── services/
│           └── converter.py   # mammoth .docx → HTML logic
├── docs/                      # Word documents go here (volume-mounted)
│   └── .gitkeep               # Keeps dir in repo; actual .docx files are gitignored
├── scripts/
│   ├── start.sh               # Build image + run container (macOS/Linux)
│   ├── stop.sh                # Stop and remove container
│   ├── start.ps1              # Windows PowerShell equivalent
│   └── stop.ps1
├── Dockerfile                 # Multi-stage: Node (Angular build) → Python (FastAPI)
├── docker-compose.yml         # Optional convenience wrapper
├── .env.example               # Example environment config
├── .gitignore
└── README.md
```

### Key Boundaries

- **`frontend/`** is a self-contained Angular project. It talks to the backend only via `/api/*` endpoints. Angular's build output is copied into the Docker image and served as static files by FastAPI.
- **`backend/`** is a self-contained uv project. It owns document scanning, conversion, and serving. It never imports Angular code.
- **`docs/`** at the project root is the volume mount point. `.docx` files dropped here are automatically discovered by the backend. The directory is in the repo (via `.gitkeep`) but actual documents are gitignored.
- **`scripts/`** contains idempotent start/stop helpers — safe to run multiple times.

---

## 5. Environment Variables

```bash
# Path inside the container where .docx files are read from
# Change only if you want to mount docs to a non-standard location
DOCS_PATH=/app/docs
```

The `DOCS_PATH` defaults to `/app/docs`, which maps to the `docs/` folder in the project root when using the provided start scripts. Most users will never need to change this.

---

## 6. Document Processing

### Conversion Pipeline

When a document is requested, the backend:

1. Looks up the `.docx` file in `DOCS_PATH` by filename
2. Passes the file to `mammoth.convert_to_html()`
3. Returns the resulting HTML string to the frontend
4. The Angular component renders it using `[innerHTML]` with appropriate sanitization

Conversion is **on-demand** (not pre-processed at startup). For small-to-medium document collections this is fast enough; mammoth converts typical documents in under 100ms.

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
- **Large images**: mammoth embeds them as base64; no size limit in v1 (could add in a later iteration)

---

## 7. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List all available `.docx` files (filename + display name) |
| GET | `/api/documents/{filename}` | Fetch the HTML-rendered content of a single document |
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

`display_name` strips the `.docx` extension. Filenames are URL-encoded when used as path parameters.

---

## 8. Frontend Design

### Pages / Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `DocumentIndexComponent` | Home page — grid/list of all documents |
| `/doc/:filename` | `DocumentViewComponent` | Full document reading view |

### Document Index Page

- Fetches `GET /api/documents` on load
- Renders a card or row for each document with its display name
- Each card links to `/doc/:filename`
- Shows "No documents found. Add .docx files to the docs/ folder." when the list is empty
- Loading spinner while fetching

### Document View Page

- Fetches `GET /api/documents/:filename` on load
- Renders returned HTML using Angular's `[innerHTML]` binding
- Applies scoped CSS to style the HTML (headings, tables, images, lists)
- "← Back to Documents" link at the top
- Shows an error message if the document cannot be loaded

### Styling Notes

- Use Angular's component-scoped styles for the document view so rendered HTML inherits appropriate typography
- Table CSS: full-width, bordered cells, alternating row shading
- Images: `max-width: 100%` to prevent overflow
- Heading hierarchy: clear size differentiation (h1 > h2 > h3)
- `DomSanitizer.bypassSecurityTrustHtml()` required to render backend HTML — apply it, but note the trust boundary (HTML comes from your own backend, not user input)

---

## 9. Docker & Deployment

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
docker run -v /path/to/your/docs:/app/docs -p 8000:8000 docviewer
```

The start script handles this automatically using `$(pwd)/docs` as the source path.

### Start/Stop Scripts

**`scripts/start.sh`** (macOS/Linux):
- Builds the Docker image if not already built (or if `--build` flag passed)
- Runs the container with the volume mount and port mapping
- Prints `App running at http://localhost:8000`

**`scripts/stop.sh`** (macOS/Linux):
- Stops and removes the running container

**`scripts/start.ps1`** / **`scripts/stop.ps1`**: PowerShell equivalents for Windows.

All scripts are idempotent — safe to run multiple times.

---

## 10. Testing Strategy

### Backend (pytest)

- **Document discovery**: scanner returns correct list from a test `docs/` fixture folder; handles empty folder; ignores non-`.docx` files
- **Conversion**: mammoth converts a known `.docx` fixture and output contains expected HTML elements (heading, table, image tag, bold)
- **API routes**: correct status codes for valid doc, missing doc, empty docs folder; response shape matches documented schema
- **Edge cases**: corrupt file returns 422; filename with spaces or special characters is handled correctly

### Frontend (Jest + Angular Testing Library)

- **DocumentIndexComponent**: renders document cards from mock API response; shows empty state message when list is empty; shows loading spinner during fetch
- **DocumentViewComponent**: renders HTML content from mock API; shows error state on failed fetch; "Back" link navigates to index
- **Routing**: navigating to `/doc/Test.docx` triggers the correct API call

### E2E (Playwright or Cypress — optional for v1)

- Fresh start: docs folder with 2 sample files → index shows 2 documents
- Click a document → view renders with visible heading text
- Back button → returns to index
