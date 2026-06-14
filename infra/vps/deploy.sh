#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-levelup-adspro}"
PROJECT_DIR="${PROJECT_DIR:-/opt/${PROJECT_NAME}}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"

cd "${PROJECT_DIR}"

if [ ! -f ".env.production" ]; then
  echo ".env.production belum ada. Buat dari .env.production.example terlebih dulu."
  exit 1
fi

git config --system --add safe.directory "${PROJECT_DIR}" >/dev/null 2>&1 || \
  git config --global --add safe.directory "${PROJECT_DIR}" >/dev/null 2>&1 || true

echo "==> Update source code"
git fetch origin

LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse "origin/${BRANCH}")"

if [ "${FORCE_DEPLOY}" != "1" ] && [ "${LOCAL_COMMIT}" = "${REMOTE_COMMIT}" ]; then
  echo "==> Tidak ada perubahan baru di origin/${BRANCH}, skip deploy"
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "==> Working tree di VPS tidak bersih. Deploy dibatalkan agar tidak menimpa perubahan lokal."
  exit 1
fi

git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "==> Build dan jalankan stack production"
docker compose \
  -p "${PROJECT_NAME}" \
  -f "${COMPOSE_FILE}" \
  --env-file .env.production \
  up -d --build

echo "==> Jalankan migration dan seed database"
docker compose \
  -p "${PROJECT_NAME}" \
  -f "${COMPOSE_FILE}" \
  --env-file .env.production \
  run --rm api sh -lc "cd apps/api && ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node prisma/seed.js"

echo "==> Deploy selesai"
docker compose \
  -p "${PROJECT_NAME}" \
  -f "${COMPOSE_FILE}" \
  --env-file .env.production \
  ps
