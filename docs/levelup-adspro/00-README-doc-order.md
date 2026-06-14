# LevelUP adsPRO - Document Order

## Tujuan

Folder ini berisi dokumen kerja awal untuk produk `LevelUP adsPRO` yang sementara disusun di dalam repo `levelup-adspro`, tetapi ditujukan untuk project baru yang terpisah.

Penamaan file memakai prefix angka agar urutan bacanya konsisten dan mudah dipakai saat planning, handoff, atau kickoff development.

## Urutan Baca yang Disarankan

### 00 - Index

- [00-README-doc-order.md](file:///d:/levelup-adspro/docs/levelup-adspro/00-README-doc-order.md)

Dipakai untuk memahami struktur dokumen dan urutan baca.

### 01 - Product Direction

- [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)

Dokumen utama untuk visi, positioning, scope produk, role, AI strategy, dan batasan MVP.

### 02 - MVP Scope

- [02-MVP-scope-and-milestones.md](file:///d:/levelup-adspro/docs/levelup-adspro/02-MVP-scope-and-milestones.md)

Dipakai untuk melihat milestone implementasi, outcome tiap fase, dan batas antara `MVP` dan `non-MVP`.

### 03 - System Design

- [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)

Dipakai untuk arah arsitektur teknis, module boundaries, data processing layer, dan draft tabel inti.

### 04 - Product Backlog

- [04-MVP-backlog-and-user-stories.md](file:///d:/levelup-adspro/docs/levelup-adspro/04-MVP-backlog-and-user-stories.md)

Dipakai untuk epic, user stories, prioritas, acceptance criteria, dan urutan sprint awal.

### 05 - ERD

- [05-ERD-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/05-ERD-v1.md)

Dipakai untuk memahami relasi antar entitas inti yang akan dibangun pada MVP.

### 06 - API Scope

- [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)

Dipakai untuk ruang lingkup endpoint backend versi awal.

### 07 - Sprint Breakdown

- [07-Sprint-1-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/07-Sprint-1-task-breakdown.md)

Dipakai untuk eksekusi sprint pertama agar bisa langsung diturunkan menjadi task implementasi.

### 08 - Data Sources

- [08-Data-sources-and-capture-modes-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/08-Data-sources-and-capture-modes-v1.md)

Dipakai untuk memahami pemisahan `connected shop` dan `public market intelligence`, termasuk use case riset keyword Shopee via extension tanpa perlu login toko.

### 09 - Sprint Breakdown

- [09-Sprint-2-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/09-Sprint-2-task-breakdown.md)

Dipakai untuk eksekusi Sprint 2 setelah foundation Sprint 1 selesai.

### 10 - Extension Capture

- [10-Extension-capture-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/10-Extension-capture-spec-v1.md)

Dipakai untuk panduan implementasi Chrome Extension pada mode `owned` dan `public`.

### 11 - Analytics Formula

- [11-Analytics-formula-and-metrics-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/11-Analytics-formula-and-metrics-v1.md)

Dipakai untuk menyamakan definisi metric, formula, ranking logic, dan output analytics lintas backend, frontend, dan AI layer.

### 12 - Ingestion Contract

- [12-Ingestion-payload-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/12-Ingestion-payload-contract-v1.md)

Dipakai untuk menyamakan kontrak data antara extension dan backend ingestion.

### 13 - UI Architecture

- [13-UI-information-architecture-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/13-UI-information-architecture-v1.md)

Dipakai untuk menyusun navigasi, modul, role visibility, dan struktur halaman aplikasi.

### 14 - Sprint Breakdown

- [14-Sprint-3-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/14-Sprint-3-task-breakdown.md)

Dipakai untuk eksekusi sprint awal extension dan ingestion setelah Sprint 1 dan 2.

### 15 - Retention Policy

- [15-Data-retention-and-storage-policy-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/15-Data-retention-and-storage-policy-v1.md)

Dipakai untuk menetapkan umur simpan data, lifecycle raw payload, archive policy, offboarding tenant, dan kontrol biaya storage.

### 16 - AI Recommendation

- [16-AI-recommendation-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/16-AI-recommendation-spec-v1.md)

Dipakai untuk mendefinisikan recommendation engine `rules-first`, jenis rekomendasi, quality gate, object schema, dan integrasi dengan AI explanation.

### 17 - Sprint Breakdown

- [17-Sprint-4-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/17-Sprint-4-task-breakdown.md)

Dipakai untuk memecah sprint setelah ingestion hidup, yaitu normalisasi data, aggregate awal, dashboard overview, dan recommendation engine v1.

### 18 - Dashboard Contract

- [18-Dashboard-data-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/18-Dashboard-data-contract-v1.md)

Dipakai untuk menyamakan bentuk response dashboard antara backend, frontend, dan AI layer, termasuk overview, freshness, ranking, recommendation summary, dan empty state.

### 19 - Auth and Permission

- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)

Dipakai untuk mendefinisikan authentication, session model, organization membership, role matrix, tenant isolation, dan baseline authorization multi-tenant.

### 20 - Sprint Breakdown

- [20-Sprint-5-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/20-Sprint-5-task-breakdown.md)

Dipakai untuk memecah sprint berikutnya yang berfokus pada auth maturity, permission guards, dashboard usability, recommendation workflow, dan market research workspace awal.

### 21 - Database Schema

- [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)

Dipakai untuk menerjemahkan ERD ke schema relational yang lebih konkret, lengkap dengan field minimum, index dasar, migration waves, dan sprint mapping implementasi database.

### 22 - Frontend Spec

- [22-Frontend-component-and-wireframe-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/22-Frontend-component-and-wireframe-spec-v1.md)

Dipakai untuk menurunkan UI information architecture ke level komponen reusable, app shell, state UI, dan wireframe halaman inti agar frontend lebih mudah dieksekusi.

### 23 - Sprint Breakdown

- [23-Sprint-6-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/23-Sprint-6-task-breakdown.md)

Dipakai untuk memecah sprint hardening berikutnya yang berfokus pada migration readiness, app shell implementation, permission UX, retention cleanup dasar, dan monitoring internal.

### 24 - Backend Modules

- [24-Backend-module-boundaries-and-service-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/24-Backend-module-boundaries-and-service-contract-v1.md)

Dipakai untuk mendisiplinkan arsitektur modular monolith di sisi backend, termasuk batas tanggung jawab modul, aturan dependency, dan service contract lintas domain.

### 25 - QA and Release

- [25-QA-testing-and-release-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/25-QA-testing-and-release-checklist-v1.md)

Dipakai untuk menetapkan quality gate, prioritas automated testing, manual QA per sprint, dan checklist release agar MVP bisa berkembang tanpa terlalu rentan regresi.

### 26 - Sprint Breakdown

- [26-Sprint-7-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/26-Sprint-7-task-breakdown.md)

Dipakai untuk memecah sprint berikutnya yang berfokus pada modularisasi backend wave awal, adopsi service contract, automated testing prioritas tinggi, dan kesiapan beta internal.

### 27 - Observability

- [27-Observability-metrics-and-incident-response-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/27-Observability-metrics-and-incident-response-v1.md)

Dipakai untuk menetapkan baseline observability, metric operasional, alert internal, severity incident, dan pola respons awal saat terjadi gangguan sistem.

### 28 - Billing and Entitlement

- [28-Billing-and-entitlement-detail-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/28-Billing-and-entitlement-detail-v1.md)

Dipakai untuk memperjelas plan catalog, status subscription, quota enforcement, feature gating, downgrade policy, dan contract entitlement lintas backend dan frontend.

### 29 - Sprint Breakdown

- [29-Sprint-8-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/29-Sprint-8-task-breakdown.md)

Dipakai untuk memecah sprint berikutnya yang berfokus pada observability baseline, monitoring internal, billing core flow, quota enforcement, dan kesiapan support untuk beta terbatas.

### 30 - Implementation Sequence

- [30-Implementation-sequence-and-bootstrap-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/30-Implementation-sequence-and-bootstrap-plan-v1.md)

Dipakai untuk menentukan urutan implementasi paling efektif dari bootstrap repo sampai dashboard, recommendation, market research, dan beta hardening agar tim tidak membangun domain berat terlalu dini.

### 31 - Repo Bootstrap

- [31-Repo-setup-and-bootstrap-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/31-Repo-setup-and-bootstrap-checklist-v1.md)

Dipakai sebagai checklist praktis untuk membuat repo baru, workspace monorepo, env template, local infra, dan tooling dasar agar project benar-benar siap mulai dikoding.

### 32 - Sprint Breakdown

- [32-Sprint-0-bootstrap-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/32-Sprint-0-bootstrap-breakdown.md)

Dipakai untuk memecah fase persiapan sebelum Sprint 1, dengan fokus pada repository creation, local stack, bootstrap app skeleton, migration tool, dan docs setup awal.

### 33 - Phase Roadmap

- [33-Phase-by-phase-execution-roadmap-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/33-Phase-by-phase-execution-roadmap-v1.md)

Dipakai sebagai peta kerja fase per fase agar project lebih mudah dikelola saat dipindahkan ke repo terpisah, termasuk objective, deliverable, entry criteria, exit criteria, dan aturan pindah fase.

## Kenapa Format Ini Dipilih

- angka di depan file memudahkan urutan baca
- nama file tetap deskriptif
- cocok untuk roadmap produk dan handoff ke tim
- mudah dipindah ke repo baru tanpa kehilangan konteks

## Catatan

- dokumen bernomor `01-07` adalah dokumen kerja awal, bukan versi final produk
- dokumen `08` memperjelas model sumber data dan capture mode yang memengaruhi roadmap produk
- dokumen `09-11` mulai masuk ke tingkat implementasi yang lebih teknis
- dokumen `12-14` menghubungkan extension, backend ingestion, dan struktur UI produk
- dokumen `15-17` mulai menetapkan lifecycle data, recommendation engine, dan tahap delivery setelah raw ingestion
- dokumen `18-20` mulai menyatukan kontrak dashboard, model auth/permission, dan sprint implementasi aplikasi multi-tenant yang lebih usable
- dokumen `21-23` menerjemahkan arsitektur ke level schema database, komponen frontend, dan sprint hardening implementasi
- dokumen `24-26` memperkuat disiplin implementasi backend, QA/release quality gate, dan langkah menuju beta internal yang lebih aman
- dokumen `27-29` memperkuat kesiapan operasional, penegakan plan dan quota, serta fondasi support untuk fase beta
- dokumen `30-32` menggeser fokus dari spesifikasi ke jalur eksekusi nyata, yaitu urutan implementasi, bootstrap repo baru, dan Sprint 0 persiapan coding
- dokumen `33` merangkum semua itu ke level roadmap manajerial fase per fase agar kontrol progres lebih mudah
- file lanjutan berikutnya sebaiknya tetap mengikuti pola nama yang sama
