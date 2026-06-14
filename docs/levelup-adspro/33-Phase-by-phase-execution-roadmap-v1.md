# LevelUP adsPRO - Phase-by-Phase Execution Roadmap v1

## 1. Tujuan

Dokumen ini merangkum alur kerja implementasi `LevelUP adsPRO` secara fase per fase agar project lebih mudah dikelola, dipindahkan ke repo terpisah, dan dipantau progresnya tanpa harus membuka semua dokumen teknis satu per satu.

Dokumen ini dipakai sebagai:

- peta kerja level manajemen
- ringkasan fase eksekusi
- alat kontrol progres dan handoff
- jembatan antara dokumen strategi dan pekerjaan implementasi

## 2. Cara Memakai Dokumen Ini

Dokumen ini tidak menggantikan dokumen teknis lain.

Gunakan dokumen ini untuk:

- melihat fase aktif saat ini
- memahami objective setiap fase
- melihat deliverable utama per fase
- mengecek syarat masuk dan keluar fase
- memutuskan apakah project siap pindah ke fase berikutnya

## 3. Gambaran Besar Fase

Roadmap eksekusi direkomendasikan dibagi menjadi:

1. Fase 0 - Project Bootstrap
2. Fase 1 - Identity and Tenant Foundation
3. Fase 2 - Shop and Plan Foundation
4. Fase 3 - Ingestion Foundation
5. Fase 4 - Analytics MVP
6. Fase 5 - Profit and Recommendation MVP
7. Fase 6 - Market Research MVP
8. Fase 7 - Operational Readiness and Beta Preparation

## 4. Fase 0 - Project Bootstrap

### Tujuan

- membuat repo baru siap dikembangkan
- menyiapkan local stack
- menyiapkan struktur project dan workflow dasar

### Fokus

- repository baru
- monorepo workspace
- app skeleton `web`, `api`, `worker`
- Docker Compose
- PostgreSQL, Redis, MinIO
- env template
- lint, format, test dasar

### Deliverable

- repo baru hidup
- semua app bisa start minimal
- local infra tersedia
- README setup awal tersedia

### Entry Criteria

- keputusan stack dasar sudah final
- struktur monorepo disetujui

### Exit Criteria

- developer bisa clone dan run project lokal
- migration dasar bisa jalan
- env template tersedia

### Referensi Dokumen

- [30-Implementation-sequence-and-bootstrap-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/30-Implementation-sequence-and-bootstrap-plan-v1.md)
- [31-Repo-setup-and-bootstrap-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/31-Repo-setup-and-bootstrap-checklist-v1.md)
- [32-Sprint-0-bootstrap-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/32-Sprint-0-bootstrap-breakdown.md)

## 5. Fase 1 - Identity and Tenant Foundation

### Tujuan

- membuat user bisa masuk ke sistem
- membuat organization pertama
- menyiapkan tenant model yang stabil

### Fokus

- auth
- signup dan login
- session model
- organization creation
- owner membership
- route guard awal

### Deliverable

- user bisa login
- organization bisa dibuat
- dashboard shell minimal bisa dibuka setelah login

### Entry Criteria

- Fase 0 selesai

### Exit Criteria

- flow auth stabil
- tenant isolation dasar berjalan
- current user dan current organization bisa dibaca

### Referensi Dokumen

- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)
- [07-Sprint-1-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/07-Sprint-1-task-breakdown.md)

## 6. Fase 2 - Shop and Plan Foundation

### Tujuan

- membuat tenant memiliki shop dan struktur plan awal
- membuka dasar untuk pembatasan fitur dan quota

### Fokus

- marketplace registry
- shop CRUD
- plan seed
- subscription read model dasar
- entitlement dan quota check dasar

### Deliverable

- tenant bisa membuat shop
- plan aktif dapat dibaca
- batas shop awal bisa mulai ditegakkan

### Entry Criteria

- Fase 1 selesai

### Exit Criteria

- shop lifecycle dasar berjalan
- tenant punya relasi bisnis yang relevan
- plan awareness mulai hadir di sistem

### Referensi Dokumen

- [28-Billing-and-entitlement-detail-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/28-Billing-and-entitlement-detail-v1.md)
- [09-Sprint-2-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/09-Sprint-2-task-breakdown.md)

## 7. Fase 3 - Ingestion Foundation

### Tujuan

- mempertemukan extension dengan backend
- menerima payload mentah pertama

### Fokus

- extension auth atau session
- ingestion batch endpoint
- validation dasar
- raw payload storage
- idempotency dasar

### Deliverable

- payload diterima backend
- metadata capture tersimpan
- jalur data mentah mulai hidup

### Entry Criteria

- Fase 2 selesai

### Exit Criteria

- extension bisa kirim payload yang valid
- backend bisa menyimpan raw data dengan aman
- basic observability untuk ingestion tersedia

### Referensi Dokumen

- [10-Extension-capture-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/10-Extension-capture-spec-v1.md)
- [12-Ingestion-payload-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/12-Ingestion-payload-contract-v1.md)
- [14-Sprint-3-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/14-Sprint-3-task-breakdown.md)

## 8. Fase 4 - Analytics MVP

### Tujuan

- mengubah raw payload menjadi data analytics yang bisa dipakai user

### Fokus

- normalization
- daily aggregate
- dashboard overview
- ranking top dan worst
- freshness indicator

### Deliverable

- overview dashboard berisi data nyata
- campaign dan product ranking mulai tersedia
- data freshness dapat dibaca

### Entry Criteria

- Fase 3 selesai

### Exit Criteria

- dashboard utama tidak lagi dummy
- metric inti sudah punya definisi dan source yang jelas
- user mulai mendapatkan nilai utama produk

### Referensi Dokumen

- [11-Analytics-formula-and-metrics-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/11-Analytics-formula-and-metrics-v1.md)
- [18-Dashboard-data-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/18-Dashboard-data-contract-v1.md)
- [17-Sprint-4-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/17-Sprint-4-task-breakdown.md)

## 9. Fase 5 - Profit and Recommendation MVP

### Tujuan

- mengubah analytics menjadi insight tindakan
- mulai menonjolkan diferensiasi produk

### Fokus

- profit settings
- cost structure dasar
- profit snapshots
- recommendation rule engine
- recommendation list dan severity

### Deliverable

- user bisa melihat profit dasar
- recommendation pertama muncul
- alasan rekomendasi dapat ditampilkan

### Entry Criteria

- Fase 4 selesai

### Exit Criteria

- recommendation berbasis rules berjalan
- nilai produk tidak hanya dashboard angka
- user dapat melihat tindakan yang disarankan

### Referensi Dokumen

- [15-Data-retention-and-storage-policy-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/15-Data-retention-and-storage-policy-v1.md)
- [16-AI-recommendation-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/16-AI-recommendation-spec-v1.md)
- [20-Sprint-5-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/20-Sprint-5-task-breakdown.md)

## 10. Fase 6 - Market Research MVP

### Tujuan

- membuka jalur data publik untuk riset produk dan kompetitor

### Fokus

- keyword research session
- public result capture
- result normalization
- saved research workspace
- summary insight dasar

### Deliverable

- user bisa menyimpan hasil riset keyword
- data publik bisa dibaca terpisah dari data toko sendiri
- market intelligence mulai usable

### Entry Criteria

- Fase 5 stabil

### Exit Criteria

- kedua jalur data sudah hidup:
  - connected shop
  - public market intelligence

### Referensi Dokumen

- [08-Data-sources-and-capture-modes-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/08-Data-sources-and-capture-modes-v1.md)
- [10-Extension-capture-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/10-Extension-capture-spec-v1.md)
- [22-Frontend-component-and-wireframe-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/22-Frontend-component-and-wireframe-spec-v1.md)

## 11. Fase 7 - Operational Readiness and Beta Preparation

### Tujuan

- menyiapkan sistem untuk beta dengan kontrol operasional yang memadai

### Fokus

- observability
- incident response
- billing and entitlement enforcement
- QA checklist
- release readiness
- support tooling dasar

### Deliverable

- internal monitoring tersedia
- entitlement lebih konsisten
- incident handling awal bisa dijalankan
- beta checklist siap

### Entry Criteria

- Fase 6 berjalan cukup stabil

### Exit Criteria

- tim bisa memantau dan menangani masalah dasar
- quota dan feature gating tidak lagi longgar
- rilis beta bisa dilakukan lebih aman

### Referensi Dokumen

- [25-QA-testing-and-release-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/25-QA-testing-and-release-checklist-v1.md)
- [27-Observability-metrics-and-incident-response-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/27-Observability-metrics-and-incident-response-v1.md)
- [28-Billing-and-entitlement-detail-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/28-Billing-and-entitlement-detail-v1.md)
- [29-Sprint-8-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/29-Sprint-8-task-breakdown.md)

## 12. Output yang Harus Terlihat di Setiap Fase

Supaya mudah dikelola, tiap fase sebaiknya menghasilkan output yang nyata:

- Fase 0: repo dan local stack hidup
- Fase 1: login dan tenant creation hidup
- Fase 2: shop dan plan awareness hidup
- Fase 3: ingestion hidup
- Fase 4: dashboard nyata hidup
- Fase 5: profit dan recommendation hidup
- Fase 6: market research hidup
- Fase 7: monitoring dan beta readiness hidup

## 13. Aturan Pindah Fase

Jangan pindah fase hanya karena coding sudah dimulai.

Pindah fase jika:

- deliverable fase saat ini benar-benar usable
- exit criteria fase saat ini terpenuhi
- blocker kritis fase sebelumnya tidak tersisa
- owner produk memahami risiko fase berikutnya

## 14. Cara Mengelola Progres

Untuk tiap fase, gunakan format kontrol sederhana:

- objective
- scope
- out of scope
- deliverables
- blockers
- exit criteria
- status

Status yang disarankan:

- `not_started`
- `in_progress`
- `blocked`
- `done`

## 15. Rekomendasi Cara Pindah ke Repo Terpisah

Saat dipindah dari `mcgroup` ke repo baru:

- bawa dokumen `00-33`
- tandai dokumen mana yang menjadi referensi aktif implementasi
- jadikan dokumen ini sebagai `entry roadmap`
- gunakan Sprint 0 sebagai fase pertama di repo baru

## 16. Dokumen Inti yang Harus Dibaca Tim Baru

Kalau tim baru hanya membaca sedikit dokumen, prioritaskan:

1. [00-README-doc-order.md](file:///d:/levelup-adspro/docs/levelup-adspro/00-README-doc-order.md)
2. [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)
3. [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)
4. [30-Implementation-sequence-and-bootstrap-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/30-Implementation-sequence-and-bootstrap-plan-v1.md)
5. [33-Phase-by-phase-execution-roadmap-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/33-Phase-by-phase-execution-roadmap-v1.md)

## 17. Catatan

- dokumen ini sengaja dibuat lebih manajerial daripada teknis
- sprint breakdown tetap dipakai untuk task detail
- implementation sequence tetap dipakai untuk urutan build
- roadmap fase ini dipakai untuk kontrol project secara keseluruhan
