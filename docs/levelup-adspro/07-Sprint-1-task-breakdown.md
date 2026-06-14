# LevelUP adsPRO - Sprint 1 Task Breakdown

## 1. Tujuan Sprint

Sprint 1 berfokus pada `foundation` agar project baru bisa berjalan sebagai aplikasi terpisah dari `mcgroup`.

Outcome sprint:

- repo baru siap dipakai
- stack lokal bisa dijalankan
- auth dasar tersedia
- organization pertama bisa dibuat

Sprint ini belum menyentuh analytics dan extension. Fokusnya adalah pondasi produk.

## 2. Target Deliverables

- repo dan struktur project
- frontend shell
- backend shell
- worker shell
- Docker Compose
- PostgreSQL
- Redis
- MinIO
- auth flow dasar
- create organization flow
- health check dan logging dasar

## 3. Daftar Task

## Epic A - Project Bootstrap

### Task A1

- Title: Buat repo project baru
- Type: Setup
- Priority: `P0`
- Output:
  - repo kosong terinisialisasi
  - branch strategy dasar ditentukan
  - README awal dibuat

### Task A2

- Title: Buat struktur folder utama
- Type: Setup
- Priority: `P0`
- Output:
  - `apps/web`
  - `apps/api`
  - `apps/worker`
  - `packages/shared` atau setara
  - `infra`
  - `docs`

### Task A3

- Title: Siapkan environment file template
- Type: Setup
- Priority: `P0`
- Output:
  - `.env.example` untuk web
  - `.env.example` untuk api
  - `.env.example` untuk worker

## Epic B - Infra Lokal

### Task B1

- Title: Siapkan Docker Compose untuk local development
- Type: Infra
- Priority: `P0`
- Output:
  - service web
  - service api
  - service worker
  - postgres
  - redis
  - minio

### Task B2

- Title: Siapkan health check service
- Type: Infra
- Priority: `P0`
- Output:
  - endpoint health backend
  - container health check dasar

### Task B3

- Title: Siapkan database migration runner
- Type: Infra
- Priority: `P0`
- Output:
  - migration command dapat dijalankan lokal
  - seed awal dapat dijalankan

## Epic C - Backend Core

### Task C1

- Title: Bootstrap NestJS API
- Type: Backend
- Priority: `P0`
- Output:
  - app NestJS hidup
  - module structure awal tersedia

### Task C2

- Title: Buat module auth
- Type: Backend
- Priority: `P0`
- Output:
  - signup endpoint
  - login endpoint
  - logout endpoint

### Task C3

- Title: Buat module organizations
- Type: Backend
- Priority: `P0`
- Output:
  - create organization
  - get current organization

### Task C4

- Title: Buat module memberships dasar
- Type: Backend
- Priority: `P1`
- Output:
  - organization member relation
  - role owner default

### Task C5

- Title: Siapkan module common untuk config, logging, dan guards
- Type: Backend
- Priority: `P0`
- Output:
  - config service
  - request logger dasar
  - auth guard dasar

## Epic D - Frontend Core

### Task D1

- Title: Bootstrap Next.js web app
- Type: Frontend
- Priority: `P0`
- Output:
  - app shell hidup
  - routing dasar tersedia

### Task D2

- Title: Buat halaman login
- Type: Frontend
- Priority: `P0`
- Output:
  - form login
  - error state
  - redirect setelah login

### Task D3

- Title: Buat halaman signup
- Type: Frontend
- Priority: `P0`
- Output:
  - form signup
  - create organization basic step

### Task D4

- Title: Buat dashboard shell placeholder
- Type: Frontend
- Priority: `P1`
- Output:
  - halaman setelah login
  - top navigation dasar
  - organization context placeholder

## Epic E - Database

### Task E1

- Title: Buat schema `users`
- Type: Database
- Priority: `P0`
- Output:
  - migration user
  - unique email

### Task E2

- Title: Buat schema `organizations`
- Type: Database
- Priority: `P0`
- Output:
  - migration organization
  - owner relation

### Task E3

- Title: Buat schema `organization_members`
- Type: Database
- Priority: `P0`
- Output:
  - relation user-organization
  - role field

### Task E4

- Title: Buat schema `plans` dan `subscriptions`
- Type: Database
- Priority: `P1`
- Output:
  - plan master
  - subscription relation ke organization

## Epic F - Dev Experience

### Task F1

- Title: Setup linting frontend dan backend
- Type: DX
- Priority: `P1`
- Output:
  - lint command jalan
  - format command tersedia

### Task F2

- Title: Setup test dasar backend
- Type: DX
- Priority: `P1`
- Output:
  - minimal auth test
  - test runner jalan

### Task F3

- Title: Setup git hooks opsional
- Type: DX
- Priority: `P2`
- Output:
  - pre-commit lint atau format jika dibutuhkan

## 4. Acceptance Criteria Sprint

Sprint 1 dianggap selesai jika:

- developer bisa menjalankan stack lokal tanpa setup rumit
- user bisa signup
- user bisa login
- organization pertama bisa dibuat
- session dasar berjalan
- project siap dilanjutkan ke Sprint 2

## 5. Estimasi Kasar

### High Effort

- Docker Compose lengkap
- auth backend
- signup dan login frontend

### Medium Effort

- organization module
- migrations inti
- session handling

### Low Effort

- health check
- logging dasar
- README dan env template

## 6. Risiko Sprint 1

- keputusan monorepo vs multi-repo belum final
- auth strategy belum final antara session atau JWT murni
- struktur shared package bisa over-engineered jika terlalu cepat dirapikan

## 7. Catatan Implementasi

- jangan mulai dari billing, analytics, atau extension di sprint ini
- utamakan developer experience yang bersih
- data model harus mengikuti dokumen [05-ERD-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/05-ERD-v1.md)
- scope API sprint ini cukup mengikuti bagian auth dan organization di [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)
