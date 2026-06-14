#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-levelup-adspro}"
PROJECT_DIR="${PROJECT_DIR:-/opt/${PROJECT_NAME}}"
BRANCH="${BRANCH:-main}"

cd "${PROJECT_DIR}"

if [ ! -f ".env.production" ]; then
  echo ".env.production belum ada. Buat dari .env.production.example terlebih dulu."
  exit 1
fi

echo "==> Update source code"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "==> Build dan jalankan stack production"
docker compose \
  -p "${PROJECT_NAME}" \
  -f docker-compose.prod.yml \
  --env-file .env.production \
  up -d --build

echo "==> Deploy selesai"
docker compose \
  -p "${PROJECT_NAME}" \
  -f docker-compose.prod.yml \
  --env-file .env.production \
  ps
