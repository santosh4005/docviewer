import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


def _mock_completion(answer_text: str):
    """Build a litellm-shaped mock response with a structured output payload."""
    from app.services.ai_chat import _ChatAnswer

    parsed = _ChatAnswer(answer=answer_text)
    message = MagicMock()
    message.parsed = parsed
    message.content = parsed.model_dump_json()
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


def test_chat_returns_answer(client: TestClient, sample_docx: Path):
    with patch("app.services.ai_chat.litellm.completion") as mock_completion:
        mock_completion.return_value = _mock_completion("The answer is 42.")
        resp = client.post(
            "/api/chat",
            json={"filename": sample_docx.name, "question": "What is the answer?"},
        )

    assert resp.status_code == 200
    assert resp.json()["answer"] == "The answer is 42."


def test_chat_uses_document_text_in_system_prompt(client: TestClient, sample_docx: Path):
    captured = {}

    def capture(**kwargs):
        captured.update(kwargs)
        return _mock_completion("captured")

    with patch("app.services.ai_chat.litellm.completion", side_effect=capture):
        client.post(
            "/api/chat",
            json={"filename": sample_docx.name, "question": "Any question"},
        )

    messages = captured["messages"]
    system_msg = next(m for m in messages if m["role"] == "system")
    user_msg = next(m for m in messages if m["role"] == "user")

    assert "DOCUMENT START" in system_msg["content"]
    assert user_msg["content"] == "Any question"
    assert captured["response_format"] is not None


def test_chat_not_found(client: TestClient):
    resp = client.post(
        "/api/chat",
        json={"filename": "missing.docx", "question": "anything"},
    )
    assert resp.status_code == 404


def test_chat_missing_api_key(client: TestClient, sample_docx: Path, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    resp = client.post(
        "/api/chat",
        json={"filename": sample_docx.name, "question": "anything"},
    )
    assert resp.status_code == 503
