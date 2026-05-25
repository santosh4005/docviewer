import os
from pathlib import Path

import mammoth
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services import converter

router = APIRouter()


def _docs_path() -> Path:
    return Path(os.environ.get("DOCS_PATH", "/app/docs"))


def _display_name(filename: str) -> str:
    return Path(filename).stem


def _find_docx(filename: str) -> Path:
    path = _docs_path() / filename
    if not path.exists() or path.suffix.lower() != ".docx":
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found")
    return path


class DocumentSummary(BaseModel):
    filename: str
    display_name: str


class DocumentDetail(BaseModel):
    filename: str
    display_name: str
    html: str


@router.get("/documents", response_model=list[DocumentSummary])
def list_documents():
    docs_dir = _docs_path()
    if not docs_dir.exists():
        return []
    files = sorted(
        f.name for f in docs_dir.iterdir() if f.suffix.lower() == ".docx"
    )
    return [DocumentSummary(filename=f, display_name=_display_name(f)) for f in files]


@router.get("/documents/{filename}", response_model=DocumentDetail)
def get_document(filename: str):
    path = _find_docx(filename)
    try:
        html = converter.convert_to_html(path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse document: {exc}")
    return DocumentDetail(
        filename=filename,
        display_name=_display_name(filename),
        html=html,
    )
