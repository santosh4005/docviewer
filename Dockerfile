# ── Stage 1: Build Angular SPA ────────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci --prefer-offline

COPY frontend/ .
RUN npx ng build --configuration production

# ── Stage 2: FastAPI runtime ───────────────────────────────────────────────
FROM python:3.10-slim AS runtime

# Install uv (official binary, no pip needed)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies from lockfile (production only)
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY backend/app ./app

# Copy Angular build output into FastAPI's static directory
COPY --from=frontend-build /build/frontend/dist/frontend/browser ./app/static

# Volume mount point for .docx files
RUN mkdir -p /app/docs

# Activate the uv-managed venv for the CMD
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
