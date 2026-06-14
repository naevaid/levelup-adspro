# LevelUP adsPRO - Implementation Sequence and Bootstrap Plan v1

## 1. Tujuan

Dokumen ini menyusun urutan implementasi paling efektif untuk `LevelUP adsPRO` agar transisi dari dokumen ke codebase nyata dapat dilakukan dengan risiko rendah dan progres yang terlihat jelas.

Tujuan utamanya:

- memilih urutan build yang paling efisien
- menghindari membangun fitur berat terlalu dini
- menjaga agar backend, frontend, dan extension bertemu di titik yang tepat
- memberi jalur eksekusi yang realistis untuk project baru

## 2. Prinsip Urutan Implementasi

- bangun fondasi yang membuat tim bisa mulai coding dengan cepat
- dahulukan flow yang membuka banyak pekerjaan lanjutan
- jangan mulai dari fitur yang sangat kompleks tetapi belum punya data source stabil
- backend, frontend, dan extension harus tumbuh bertahap, bukan semua sekaligus
- data pipeline awal lebih penting daripada fitur AI yang terlihat canggih

## 3. Kesimpulan Urutan Paling Efektif

Urutan implementasi yang saya rekomendasikan:

1. bootstrap repo dan local stack
2. auth + organization + membership dasar
3. shops + subscription basic + entitlement basic
4. extension session + ingestion acceptance
5. normalization + aggregate + dashboard read model
6. frontend app shell + dashboard overview usable
7. profit settings + recommendation rule v1
8. market research public flow
9. observability + support tools + beta hardening

## 4. Kenapa Urutan Ini Dipilih

Kalau langsung mulai dari:

- AI chat
- billing kompleks
- alert multi-channel
- competitor intelligence penuh

maka tim akan cepat masuk ke area berat tanpa fondasi data dan operasional yang stabil.

Sebaliknya, jika mulai dari:

- repo
- auth
- shops
- ingestion
- aggregate

maka sistem akan lebih cepat mencapai titik:

- bisa login
- bisa punya tenant
- bisa menerima data
- bisa menampilkan dashboard

Itu adalah milestone paling penting untuk membuat produk terasa hidup.

## 5. Fase Implementasi yang Direkomendasikan

## Fase A - Bootstrap and Foundation

Tujuan:

- project baru bisa dijalankan lokal
- repo siap dipakai tim
- standar coding dan infra dasar tersedia

Fokus:

- monorepo structure
- Docker Compose
- Next.js shell
- NestJS API
- worker shell
- env template
- lint dan basic DX

Output:

- repo baru hidup
- stack lokal bisa dijalankan
- CI dasar bisa ditambahkan

## Fase B - Identity and Tenant Core

Tujuan:

- user bisa signup dan login
- organization pertama bisa dibuat
- membership owner tersedia

Fokus:

- auth module
- organizations module
- memberships dasar
- sessions
- route guard frontend dasar

Output:

- tenant app sudah punya entry point nyata

## Fase C - Shops and Plan Control

Tujuan:

- tenant bisa punya shop
- subscription dan limit awal mulai aktif

Fokus:

- shop CRUD
- marketplace registry
- plan seed
- subscription read model
- shop quota check dasar

Output:

- produk mulai punya struktur bisnis yang relevan

## Fase D - Ingestion Foundation

Tujuan:

- extension dan backend bisa bertemu
- payload mentah pertama bisa diterima

Fokus:

- extension login
- extension session
- ingestion batch endpoint
- raw payload metadata
- object storage integration

Output:

- jalur data mulai hidup

## Fase E - Analytics MVP

Tujuan:

- data mentah berubah menjadi dashboard yang berguna

Fokus:

- normalization owned data
- aggregate harian
- dashboard overview
- top and worst campaign
- top and worst product

Output:

- user mulai melihat value utama produk

## Fase F - Profit and Recommendation MVP

Tujuan:

- dashboard bukan hanya angka, tetapi mulai memberi keputusan

Fokus:

- shop profit settings
- product cost overrides
- profit snapshots
- recommendation rule engine
- recommendation list and detail

Output:

- diferensiasi produk mulai terasa

## Fase G - Market Research MVP

Tujuan:

- jalur public market intelligence mulai usable

Fokus:

- keyword research session capture
- result normalization
- saved research UI
- basic summary insights

Output:

- produk memiliki dua jalur data sesuai PRD

## Fase H - Beta Hardening

Tujuan:

- sistem siap dipakai user beta secara lebih aman

Fokus:

- observability
- entitlement enforcement penuh
- internal support tools
- QA checklist
- release process

Output:

- beta readiness

## 6. Mapping ke Jalur Backend, Frontend, dan Extension

### Backend-First Work

Pekerjaan yang harus didahulukan:

- auth
- organizations
- memberships
- shops
- ingestion
- analytics normalization
- profit
- recommendations

Alasan:

- frontend dan extension akan bergantung kuat ke sini

### Frontend Work

Fokus setelah backend dasar siap:

- login
- signup
- app shell
- dashboard overview
- shops UI
- recommendation UI
- market research UI

Alasan:

- frontend paling efektif saat contract API sudah cukup stabil

### Extension Work

Waktu terbaik memulai:

- setelah auth tenant, extension session, dan ingestion endpoint dasar siap

Alasan:

- extension tanpa backend acceptance hanya akan menghasilkan pekerjaan setengah jadi

## 7. Apa yang Jangan Didahulukan

Fitur yang tidak sebaiknya didahulukan:

- AI chat analyst penuh
- multi-provider billing yang kompleks
- alert WhatsApp atau Telegram produksi
- competitor tracking yang sangat luas
- API access publik untuk plan tinggi
- warehouse analytics terpisah

Alasan:

- semuanya bergantung pada fondasi yang belum matang jika dibangun terlalu awal

## 8. Realistic Build Path Mingguan

Contoh jalur realistis:

### Minggu 1

- bootstrap repo
- Docker Compose
- web/api/worker shell

### Minggu 2

- auth
- organization
- session

### Minggu 3

- shops
- plans
- subscription read model

### Minggu 4

- extension session
- ingestion batch
- raw payload metadata

### Minggu 5-6

- normalization
- aggregate
- overview dashboard

### Minggu 7

- profit
- recommendation v1

### Minggu 8

- market research v1
- observability and beta checklist

## 9. Output Milestone yang Harus Dikejar

### Milestone 1

- developer bisa menjalankan stack lokal

### Milestone 2

- user bisa login dan punya organization

### Milestone 3

- tenant bisa tambah shop

### Milestone 4

- extension bisa kirim payload dan backend menerima

### Milestone 5

- dashboard overview menampilkan data nyata

### Milestone 6

- recommendation pertama muncul

### Milestone 7

- market research session tersimpan dan bisa dilihat

### Milestone 8

- sistem siap beta terbatas

## 10. Recommended Handoff dari Dokumen ke Code

Urutan dokumen yang paling penting untuk dipakai saat mulai implementasi:

1. [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)
2. [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)
3. [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)
4. [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)
5. [24-Backend-module-boundaries-and-service-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/24-Backend-module-boundaries-and-service-contract-v1.md)
6. [22-Frontend-component-and-wireframe-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/22-Frontend-component-and-wireframe-spec-v1.md)
7. [30-Implementation-sequence-and-bootstrap-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/30-Implementation-sequence-and-bootstrap-plan-v1.md)

## 11. Prioritas Kalau Resource Sangat Terbatas

Jika tim sangat kecil, urutan minimum:

1. backend auth + organization
2. frontend login + app shell
3. shops + plans basic
4. ingestion acceptance
5. dashboard overview
6. recommendation v1

Market research bisa masuk setelah itu.

## 12. Prioritas Kalau Ingin Cepat Demo

Jika target utama adalah demo cepat:

1. bootstrap repo
2. login
3. dashboard shell
4. seeded demo data
5. recommendation cards mock dari data statis

Namun ini hanya cocok untuk demo, bukan fondasi produk jangka menengah.

## 13. Risiko Implementasi yang Harus Diwaspadai

- mulai dari extension terlalu dini
- frontend membangun terlalu banyak halaman sebelum data contract stabil
- backend membuat modul terlalu kompleks di minggu awal
- AI dijadikan fokus sebelum data aggregate stabil
- billing dibuat rumit sebelum entitlement dasar matang

## 14. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [07-Sprint-1-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/07-Sprint-1-task-breakdown.md)
- [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)
- [24-Backend-module-boundaries-and-service-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/24-Backend-module-boundaries-and-service-contract-v1.md)
- [26-Sprint-7-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/26-Sprint-7-task-breakdown.md)

## 15. Open Questions

- apakah repo baru akan langsung dibuat monorepo atau bertahap dari api dulu
- apakah extension akan dibootstrap sejajar sejak minggu pertama atau ditunda sampai ingestion endpoint stabil
- apakah demo data perlu dipersiapkan sejak Sprint 0 untuk mempermudah frontend
- siapa yang menjadi jalur implementasi pertama: backend dulu atau frontend dulu dalam tim nyata
