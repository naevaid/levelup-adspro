# LevelUP adsPRO

Repo monorepo untuk pengembangan `LevelUP adsPRO`.

## Status Saat Ini

Sprint aktif saat ini adalah `Sprint 0`, dengan fokus pada bootstrap codebase, workspace, dan local stack.

## Stack

- `Next.js` untuk `apps/web`
- `NestJS` untuk `apps/api`
- `NestJS` application context untuk `apps/worker`
- `npm workspaces` untuk monorepo
- `Docker Compose` untuk PostgreSQL, Redis, dan MinIO lokal

## Struktur Repo

```text
apps/
  web/
  api/
  worker/
packages/
  shared/
infra/
  docker/
docs/
  levelup-adspro/
```

## Prasyarat

- `Node.js` 22+
- `npm` 10+
- `Docker` dan `docker compose` untuk infra lokal

## Setup Lokal

1. Install dependency workspace:

```bash
npm install
```

2. Salin template environment yang dibutuhkan:

```bash
copy .env.example .env
copy apps\web\.env.example apps\web\.env.local
copy apps\api\.env.example apps\api\.env
copy apps\worker\.env.example apps\worker\.env
```

3. Nyalakan infra lokal:

```bash
npm run infra:up
```

4. Jalankan seluruh app:

```bash
npm run dev
```

## Script Root

- `npm run dev` menjalankan `web`, `api`, dan `worker`
- `npm run dev:web` menjalankan Next.js app
- `npm run dev:api` menjalankan API mode watch
- `npm run dev:worker` menjalankan worker mode watch
- `npm run build` build semua workspace
- `npm run lint` lint semua workspace
- `npm run test` test semua workspace
- `npm run infra:up` menyalakan PostgreSQL, Redis, dan MinIO
- `npm run infra:down` mematikan local stack
- `npm run infra:logs` melihat log container

## Endpoint Awal

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/health`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Container Bootstrap

Docker Compose sekarang memuat service berikut:

- `web`
- `api`
- `worker`
- `postgres`
- `redis`
- `minio`

Untuk bootstrap container lokal:

```bash
docker compose up --build
```

## Environment Template

- Root: `.env.example`
- Web: `apps/web/.env.example`
- API: `apps/api/.env.example`
- Worker: `apps/worker/.env.example`

Template ini masih level bootstrap dan akan disempurnakan saat config module, storage integration, dan auth mulai diimplementasikan.

## Dokumen Awal Yang Disarankan

- `docs/levelup-adspro/00-README-doc-order.md`
- `docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md`
- `docs/levelup-adspro/30-Implementation-sequence-and-bootstrap-plan-v1.md`
- `docs/levelup-adspro/31-Repo-setup-and-bootstrap-checklist-v1.md`
- `docs/levelup-adspro/32-Sprint-0-bootstrap-breakdown.md`
- `docs/levelup-adspro/33-Phase-by-phase-execution-roadmap-v1.md`

## Deploy Note

- Catatan awal subdomain dan deployment ada di `infra/docker/deploy-notes.md`
- Subdomain frontend yang sudah disiapkan saat ini: `adspro.naeva.id`
