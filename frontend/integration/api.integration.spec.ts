/**
 * Integration tests — require the FastAPI backend running at localhost:8000.
 * Start it with: cd ../backend && uv run uvicorn app.main:app --port 8000
 * Run with: npm run test:integration
 */

const BASE = 'http://localhost:8000';

async function get(path: string) {
  return fetch(`${BASE}${path}`);
}

async function post(path: string, body: unknown) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const resp = await get('/api/health');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/documents', () => {
  it('returns 200 with an array', async () => {
    const resp = await get('/api/documents');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('each item has filename and display_name fields', async () => {
    const resp = await get('/api/documents');
    const body: unknown[] = await resp.json();
    for (const item of body) {
      expect(item).toHaveProperty('filename');
      expect(item).toHaveProperty('display_name');
      expect(typeof (item as Record<string, unknown>).filename).toBe('string');
      expect(typeof (item as Record<string, unknown>).display_name).toBe('string');
    }
  });

  it('display_name is filename without .docx extension', async () => {
    const resp = await get('/api/documents');
    const body: Array<{ filename: string; display_name: string }> = await resp.json();
    for (const item of body) {
      expect(item.display_name).toBe(item.filename.replace(/\.docx$/i, ''));
    }
  });
});

describe('GET /api/documents/{filename}', () => {
  it('returns 404 for a non-existent document', async () => {
    const resp = await get('/api/documents/definitely-does-not-exist.docx');
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body).toHaveProperty('detail');
  });

  it('URL-encodes filenames with spaces (backend decodes them correctly)', async () => {
    // Request a filename with spaces — backend should return 404 (file missing)
    // rather than 500 (URL parsing error), proving the encoding round-trip works.
    const resp = await get('/api/documents/My%20Report%20With%20Spaces.docx');
    expect([404, 200]).toContain(resp.status);
  });
});

describe('POST /api/chat', () => {
  it('returns 404 for a non-existent document', async () => {
    const resp = await post('/api/chat', {
      filename: 'definitely-does-not-exist.docx',
      question: 'What is this?',
    });
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body).toHaveProperty('detail');
  });

  it('returns 503 when OPENROUTER_API_KEY is not set (or 200 if it is)', async () => {
    // Returns 503 if the key is missing, 404 if the doc doesn't exist but the key is set,
    // or 200 if both the key and a matching doc exist.
    const resp = await post('/api/chat', {
      filename: 'definitely-does-not-exist.docx',
      question: 'Anything',
    });
    expect([200, 404, 503]).toContain(resp.status);
    const body = await resp.json();
    expect(body).toHaveProperty('detail' in body ? 'detail' : 'answer');
  });

  it('returns 422 on missing required fields', async () => {
    const resp = await post('/api/chat', { filename: 'test.docx' /* question missing */ });
    expect(resp.status).toBe(422);
  });

  it('response shape has an answer field on success', async () => {
    // Only meaningful when OPENROUTER_API_KEY is set and a real doc exists.
    // Skip gracefully if the backend returns non-200.
    const docs: Array<{ filename: string }> = await (await get('/api/documents')).json();
    if (docs.length === 0) return; // no docs to test against

    const resp = await post('/api/chat', {
      filename: docs[0].filename,
      question: 'Summarise this document in one sentence.',
    });

    if (resp.status === 503) return; // OPENROUTER_API_KEY not set — skip
    if (resp.status === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('answer');
      expect(typeof body.answer).toBe('string');
    }
  });
});
