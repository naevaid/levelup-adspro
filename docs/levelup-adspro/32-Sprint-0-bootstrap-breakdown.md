# LevelUP adsPRO - Sprint 0 Bootstrap Breakdown

## 1. Tujuan Sprint

Sprint 0 adalah fase persiapan sebelum Sprint 1. Fokusnya bukan fitur produk, tetapi memastikan repo baru, stack lokal, dan keputusan teknis minimum sudah siap agar implementasi Sprint 1 tidak tersendat oleh pekerjaan setup.

Outcome sprint:

- repo baru terbentuk
- struktur monorepo siap
- local stack bisa dijalankan
- env template siap
- migration dan seed awal siap

## 2. Target Deliverables

- repository baru
- workspace monorepo
- app skeleton untuk web, api, worker
- Docker Compose lokal
- PostgreSQL, Redis, MinIO lokal
- scripts dev dasar
- docs setup awal

## 3. Daftar Task

## Epic A - Repository Creation

### Task A1

- Title: Buat repository baru LevelUP adsPRO
- Type: Setup
- Priority: `P0`
- Output:
  - repo tersedia
  - default branch ditentukan
  - README awal tersedia

### Task A2

- Title: Tentukan branch dan commit convention dasar
- Type: Process
- Priority: `P1`
- Output:
  - naming branch guideline
  - commit style guideline singkat

## Epic B - Workspace and Project Structure

### Task B1

- Title: Setup monorepo workspace
- Type: Setup
- Priority: `P0`
- Output:
  - root workspace config
  - package manager workspace hidup

### Task B2

- Title: Buat struktur folder utama
- Type: Setup
- Priority: `P0`
- Output:
  - `apps/web`
  - `apps/api`
  - `apps/worker`
  - `packages/shared`
  - `infra`
  - `docs`

### Task B3

- Title: Tambahkan scripts root minimal
- Type: Setup
- Priority: `P1`
- Output:
  - dev
  - lint
  - test
  - db scripts placeholder

## Epic C - Application Skeleton

### Task C1

- Title: Bootstrap Next.js app
- Type: Frontend
- Priority: `P0`
- Output:
  - app web hidup
  - home placeholder

### Task C2

- Title: Bootstrap NestJS API app
- Type: Backend
- Priority: `P0`
- Output:
  - health endpoint
  - module root

### Task C3

- Title: Bootstrap worker app
- Type: Backend
- Priority: `P1`
- Output:
  - worker process placeholder
  - Redis connection placeholder

## Epic D - Local Infra

### Task D1

- Title: Setup Docker Compose untuk PostgreSQL, Redis, dan MinIO
- Type: Infra
- Priority: `P0`
- Output:
  - docker compose file
  - local services hidup

### Task D2

- Title: Tambahkan container health checks
- Type: Infra
- Priority: `P1`
- Output:
  - DB health
  - Redis health
  - MinIO health

### Task D3

- Title: Tambahkan init storage atau bucket setup dasar
- Type: Infra
- Priority: `P1`
- Output:
  - bucket placeholder
  - local storage docs

## Epic E - Environment and DX

### Task E1

- Title: Buat `.env.example` untuk seluruh app
- Type: Setup
- Priority: `P0`
- Output:
  - env web
  - env api
  - env worker

### Task E2

- Title: Setup lint dan formatter dasar
- Type: DX
- Priority: `P0`
- Output:
  - lint config
  - format config
  - scripts jalan

### Task E3

- Title: Setup test runner dasar
- Type: DX
- Priority: `P1`
- Output:
  - backend test placeholder
  - frontend test placeholder

## Epic F - Database Bootstrap

### Task F1

- Title: Setup migration tool
- Type: Database
- Priority: `P0`
- Output:
  - migration folder
  - migration command

### Task F2

- Title: Setup seed data minimal
- Type: Database
- Priority: `P1`
- Output:
  - plans seed placeholder
  - marketplaces seed placeholder

### Task F3

- Title: Uji reset dan migrate local DB
- Type: Database
- Priority: `P1`
- Output:
  - reset workflow terdokumentasi

## Epic G - Documentation and Handoff

### Task G1

- Title: Tambahkan setup guide repo baru
- Type: Docs
- Priority: `P0`
- Output:
  - how to run local
  - dependency list

### Task G2

- Title: Tambahkan link dokumen eksekusi inti
- Type: Docs
- Priority: `P1`
- Output:
  - README mengarah ke PRD, architecture, API scope, schema plan

## 4. Acceptance Criteria Sprint

Sprint 0 dianggap selesai jika:

- repo baru sudah ada
- workspace monorepo berjalan
- web, api, dan worker bisa start minimal
- PostgreSQL, Redis, dan MinIO hidup lokal
- migration tool bisa dijalankan
- env template tersedia
- README setup awal tersedia

## 5. Dependency

Sprint ini bergantung pada:

- [07-Sprint-1-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/07-Sprint-1-task-breakdown.md)
- [30-Implementation-sequence-and-bootstrap-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/30-Implementation-sequence-and-bootstrap-plan-v1.md)
- [31-Repo-setup-and-bootstrap-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/31-Repo-setup-and-bootstrap-checklist-v1.md)

## 6. Risiko Sprint 0

- terlalu lama di setup dan belum masuk fitur inti
- memilih terlalu banyak tooling sebelum perlu
- repo hidup tetapi workflow start lokal belum jelas
- env dan docker configuration terlalu rumit untuk fase awal

## 7. Catatan Implementasi

- Sprint 0 harus singkat dan tajam
- jangan memasukkan auth, dashboard, atau ingestion penuh ke sprint ini
- targetnya adalah membuka jalan agar Sprint 1 bisa langsung fokus ke product foundation
