#!/usr/bin/env bash
set -euo pipefail

IMAGE="docviewer"
CONTAINER="docviewer"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Warn if API key is missing ─────────────────────────────────────────────
if [[ -f "$ROOT/.env" ]]; then
  if ! grep -q "^OPENROUTER_API_KEY=.\+" "$ROOT/.env" 2>/dev/null && [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
    echo "Warning: OPENROUTER_API_KEY is not set — AI chat will return 503."
  fi
elif [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Warning: OPENROUTER_API_KEY is not set — AI chat will return 503."
fi

# ── Build image (Docker layer cache makes this fast when nothing changed) ──
echo "Building Docker image…"
docker build -t "$IMAGE" "$ROOT"

# ── Remove stale container if present ─────────────────────────────────────
docker rm -f "$CONTAINER" 2>/dev/null || true

# ── Run ───────────────────────────────────────────────────────────────────
ENV_ARG=()
[[ -f "$ROOT/.env" ]] && ENV_ARG=(--env-file "$ROOT/.env")

docker run -d \
  --name "$CONTAINER" \
  -v "$ROOT/docs:/app/docs" \
  "${ENV_ARG[@]}" \
  -p 8080:8000 \
  "$IMAGE"

echo "App running at http://localhost:8080"
