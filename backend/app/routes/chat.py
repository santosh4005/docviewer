import os

import mammoth
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.routes.documents import _find_docx
from app.services import ai_chat, converter

router = APIRouter()


class ChatRequest(BaseModel):
    filename: str
    question: str


class ChatResponse(BaseModel):
    answer: str


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="AI chat is not configured. Set the OPENROUTER_API_KEY environment variable.",
        )

    path = _find_docx(body.filename)

    try:
        text = converter.extract_text(path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse document: {exc}")

    answer = ai_chat.answer(text, body.question)
    return ChatResponse(answer=answer)
