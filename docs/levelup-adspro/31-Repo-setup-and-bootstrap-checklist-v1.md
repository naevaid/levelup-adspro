# LevelUP adsPRO - Repo Setup and Bootstrap Checklist v1

## 1. Tujuan

Dokumen ini menjadi checklist praktis untuk menyiapkan repo baru `LevelUP adsPRO` agar proses bootstrap tidak menyebar ke banyak keputusan kecil yang belum terdokumentasi.

Fokusnya:

- struktur repo
- tooling inti
- env dan local stack
- standar awal coding dan DX

## 2. Keputusan Awal yang Direkomendasikan

Rekomendasi awal:

- gunakan `monorepo`
- pisahkan `apps/web`, `apps/api`, `apps/worker`
- gunakan Docker Compose untuk local environment
- simpan docs produk di dalam repo baru sejak awal

Alasan:

- backend, frontend, dan worker saling terkait erat
- satu repo memudahkan handoff dan perubahan lintas layer
- lebih cocok untuk tim kecil atau fase awal

## 3. Struktur Folder Awal

Struktur minimal yang disarankan:

```text
/apps
  /web
  /api
  /worker
/packages
  /shared
/infra
  /docker
/docs
/scripts
```

Opsional:

```text
/tools
/examples
```

## 4. Checklist Repo Initialization

- buat repository baru
- tentukan default branch
- buat `README.md`
- buat `.gitignore`
- buat license internal jika diperlukan
- aktifkan protected branch bila sudah siap
- tentukan naming convention branch

## 5. README Awal Minimal

`README.md` awal sebaiknya memuat:

- tujuan project
- stack utama
- struktur folder
- cara menjalankan lokal
- link ke dokumen penting

## 6. Package Manager dan Workspace

Pilih satu package manager workspace dan konsisten.

Contoh opsi:

- `pnpm`
- `npm workspaces`

Rekomendasi awal:

- `pnpm` untuk monorepo ergonomics dan kecepatan

Checklist:

- buat workspace root config
- buat scripts root
- buat shared lint or format config

## 7. App Bootstrap Checklist

### Web App

- bootstrap Next.js
- setup routing dasar
- setup environment loading
- setup app shell placeholder

### API App

- bootstrap NestJS
- setup config module
- setup health endpoint
- setup logger dasar

### Worker App

- bootstrap NestJS worker atau process worker
- setup Redis connection
- setup queue runner dasar

## 8. Local Infra Checklist

Service minimal:

- PostgreSQL
- Redis
- MinIO

Checklist:

- buat `docker-compose.yml`
- buat volume persistence lokal
- set port mapping yang tidak bentrok
- buat health check container
- buat seed bucket atau init scripts bila perlu

## 9. Environment Variable Checklist

Minimal siapkan:

### Root or Shared

- `NODE_ENV`
- `APP_ENV`

### API

- `DATABASE_URL`
- `REDIS_URL`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `JWT_SECRET` atau session secret

### Web

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV`

### Worker

- `DATABASE_URL`
- `REDIS_URL`
- `MINIO_*`

Checklist:

- buat `.env.example`
- jangan commit secret nyata
- tulis mana yang wajib dan opsional

## 10. Tooling Checklist

### Lint and Format

- ESLint
- Prettier atau formatter setara
- format script root
- lint script root

### Testing

- backend test runner
- frontend test runner dasar
- test script root

### Git Hooks

Opsional tetapi berguna:

- pre-commit lint staged
- pre-push test minimal

## 11. Database Bootstrap Checklist

- setup migration tool
- buat migration folder
- buat seed folder
- verifikasi migration run dari local container
- verifikasi reset DB workflow

Seed minimum:

- plans
- marketplaces
- demo admin atau owner opsional

## 12. Auth Bootstrap Checklist

- tentukan auth approach awal
- setup password hashing
- setup session atau token issuance
- setup route protection dasar
- setup current user endpoint

Checklist keputusan:

- session-based, JWT, atau hybrid
- cookie vs bearer token untuk web app

## 13. Shared Package Checklist

Jika memakai `packages/shared`, awalnya cukup ringan.

Isi awal yang mungkin:

- types atau DTO shared ringan
- constants
- helper validation kecil

Hindari terlalu cepat memasukkan:

- domain logic berat
- banyak abstraction prematur

## 14. Script Checklist

Script root minimal:

- `dev:web`
- `dev:api`
- `dev:worker`
- `dev`
- `lint`
- `format`
- `test`
- `db:migrate`
- `db:seed`

## 15. CI Placeholder Checklist

Belum harus kompleks, tetapi siapkan arah:

- install dependencies
- run lint
- run test minimal
- optional build check

## 16. Security Checklist untuk Bootstrap

- secret tidak hard-coded
- `.env` nyata tidak ikut ke repo
- token dummy hanya untuk local
- port publik lokal tidak terlalu terbuka
- bucket MinIO lokal tidak memakai credential default saat nanti pindah staging

## 17. Documentation Bootstrap Checklist

Masukkan ke repo baru:

- README utama
- link atau copy dokumen roadmap inti
- setup guide
- env guide
- local run guide

## 18. Definition of Done untuk Bootstrap Repo

Bootstrap dianggap selesai jika:

- repo baru sudah ada
- workspace berjalan
- web/api/worker bisa start
- PostgreSQL, Redis, MinIO hidup lokal
- migration dasar bisa jalan
- lint dan test command minimal jalan
- env template tersedia

## 19. Anti-Patterns Saat Bootstrap

- terlalu banyak shared package sebelum perlu
- langsung membangun module analytics berat sebelum auth dan tenant siap
- memilih terlalu banyak tools sekaligus
- menunda env documentation
- repo sudah hidup tetapi tidak ada cara start yang jelas

## 20. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [07-Sprint-1-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/07-Sprint-1-task-breakdown.md)
- [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)
- [30-Implementation-sequence-and-bootstrap-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/30-Implementation-sequence-and-bootstrap-plan-v1.md)

## 21. Open Questions

- apakah repo baru akan dibuat di mesin lokal ini atau langsung di server/VPS dev
- apakah docs lama akan dipindahkan penuh ke repo baru atau cukup subset eksekusi
- apakah worker perlu langsung app terpisah atau cukup mode proses kedua dari API di fase sangat awal
