from pathlib import Path

from fastapi.testclient import TestClient


def test_list_documents_empty(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("DOCS_PATH", str(tmp_path))
    from fastapi.testclient import TestClient as _TC
    from app.main import app as _app
    resp = _TC(_app).get("/api/documents")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_documents(client: TestClient, sample_docx: Path):
    resp = client.get("/api/documents")
    assert resp.status_code == 200
    data = resp.json()
    assert any(d["filename"] == sample_docx.name for d in data)
    doc = next(d for d in data if d["filename"] == sample_docx.name)
    assert doc["display_name"] == sample_docx.stem


def test_list_ignores_non_docx(client: TestClient, docs_dir: Path):
    txt = docs_dir / "readme.txt"
    txt.write_text("hello")
    resp = client.get("/api/documents")
    names = [d["filename"] for d in resp.json()]
    assert "readme.txt" not in names
    txt.unlink()


def test_get_document(client: TestClient, sample_docx: Path):
    resp = client.get(f"/api/documents/{sample_docx.name}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["filename"] == sample_docx.name
    assert body["display_name"] == sample_docx.stem
    assert "<" in body["html"]  # some HTML was produced


def test_get_document_not_found(client: TestClient):
    resp = client.get("/api/documents/does_not_exist.docx")
    assert resp.status_code == 404


def test_health(client: TestClient):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
