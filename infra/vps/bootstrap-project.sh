#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-levelup-adspro}"
PROJECT_DIR="${PROJECT_DIR:-/opt/${PROJECT_NAME}}"
PROJECT_USER="${PROJECT_USER:-levelup}"
PROJECT_GROUP="${PROJECT_GROUP:-${PROJECT_USER}}"
REPO_URL="${REPO_URL:-https://github.com/naevaid/levelup-adspro.git}"
BRANCH="${BRANCH:-main}"

echo "==> Menyiapkan project VPS ${PROJECT_NAME}"

if ! id -u "${PROJECT_USER}" >/dev/null 2>&1; then
  sudo useradd --system --create-home --shell /bin/bash "${PROJECT_USER}"
fi

if ! getent group "${PROJECT_GROUP}" >/dev/null 2>&1; then
  sudo groupadd "${PROJECT_GROUP}"
fi

sudo mkdir -p "${PROJECT_DIR}"
sudo chown -R "${PROJECT_USER}:${PROJECT_GROUP}" "${PROJECT_DIR}"

if [ ! -d "${PROJECT_DIR}/.git" ]; then
  sudo -u "${PROJECT_USER}" git clone --branch "${BRANCH}" "${REPO_URL}" "${PROJECT_DIR}"
else
  echo "==> Repo sudah ada, skip clone"
fi

if [ ! -f "${PROJECT_DIR}/.env.production" ] && [ -f "${PROJECT_DIR}/.env.production.example" ]; then
  sudo -u "${PROJECT_USER}" cp "${PROJECT_DIR}/.env.production.example" "${PROJECT_DIR}/.env.production"
  echo "==> File .env.production dibuat dari template, isi secret production sebelum deploy"
fi

echo "==> Struktur project siap di ${PROJECT_DIR}"
echo "==> Langkah berikutnya:"
echo "    1. edit ${PROJECT_DIR}/.env.production"
echo "    2. jalankan infra/vps/deploy.sh"
