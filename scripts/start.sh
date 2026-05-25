#!/usr/bin/env bash
set -euo pipefail

IMAGE="docviewer"
CONTAINER="docviewer"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Load .env if present ──────────────────────────────────────────────────
if [[ -f "$ROOT/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[[:space:]]*# ]] && continue   # skip comments
    [[ -z "$key" ]] && continue                  # skip blank lines
    key="${key%%[[:space:]]*}"                    # strip trailing whitespace
    value="${value%%#*}"                          # strip inline comments
    value="${value%"${value##*[![:space:]]}"}"    # trim trailing whitespace
    value="${value#\"}" ; value="${value%\"}"     # strip optional quotes
    [[ -n "$key" && -z "${!key+set}" ]] && export "$key=$value"
  done < "$ROOT/.env"
fi

# ── Warn if API key is missing ─────────────────────────────────────────────
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "Warning: OPENROUTER_API_KEY is not set — AI chat will return 503."
fi

# ── Build image (Docker layer cache makes this fast when nothing changed) ──
echo "Building Docker image…"
docker build -t "$IMAGE" "$ROOT"

# ── Remove stale container if present ─────────────────────────────────────
docker rm -f "$CONTAINER" 2>/dev/null || true

# ── Run ───────────────────────────────────────────────────────────────────
docker run -d \
  --name "$CONTAINER" \
  -v "$ROOT/docs:/app/docs" \
  -e "OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}" \
  -p 8000:8000 \
  "$IMAGE"

echo "App running at http://localhost:8000"
