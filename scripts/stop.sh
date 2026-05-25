#!/usr/bin/env bash
set -euo pipefail

docker rm -f docviewer 2>/dev/null && echo "Stopped." || echo "Container was not running."
