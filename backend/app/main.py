import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from app.routes import chat, documents

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("OPENROUTER_API_KEY"):
        logger.warning(
            "OPENROUTER_API_KEY is not set — /api/chat will return 503 until it is configured."
        )
    docs_path = Path(os.environ.get("DOCS_PATH", "/app/docs"))
    if not docs_path.exists():
        logger.warning("DOCS_PATH '%s' does not exist.", docs_path)
    yield


app = FastAPI(title="DocViewer", lifespan=lifespan)

app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve Angular static files with SPA fallback for client-side routing.
_static = Path(__file__).parent / "static"


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    if not _static.exists():
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    file_path = _static / full_path
    if file_path.is_file():
        return FileResponse(str(file_path))

    index_path = _static / "index.html"
    if index_path.exists():
        return HTMLResponse(content=index_path.read_text(encoding="utf-8"))

    return JSONResponse({"detail": "Not Found"}, status_code=404)
