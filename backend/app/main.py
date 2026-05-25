import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

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


# Serve Angular static files — must be mounted last so /api/* routes take priority.
_static = Path(__file__).parent / "static"
if _static.exists():
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="static")
