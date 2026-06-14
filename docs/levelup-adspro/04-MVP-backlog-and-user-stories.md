# LevelUP adsPRO - MVP Backlog and User Stories

## 1. Tujuan Dokumen

Dokumen ini menyusun backlog MVP `LevelUP adsPRO` dalam format yang siap diturunkan menjadi task development. Struktur backlog dibagi per epic, user story, priority, dan acceptance criteria.

Backlog ini mengikuti dokumen:

- [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)
- [02-MVP-scope-and-milestones.md](file:///d:/levelup-adspro/docs/levelup-adspro/02-MVP-scope-and-milestones.md)
- [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)

## 2. Prioritas

### P0

Harus ada untuk beta internal dan validasi inti produk.

### P1

Sangat penting untuk MVP publik, tetapi bisa menyusul setelah core stabil.

### P2

Bagus untuk early growth, tidak wajib untuk validasi pertama.

## 3. Definisi Selesai

Sebuah story dianggap selesai jika:

- sudah ada implementasi
- sudah ada validasi acceptance criteria
- error handling dasar tersedia
- audit/log minimal tersedia jika story menyentuh flow sensitif
- UI atau API sudah konsisten dengan PRD

## 4. Epic A - Foundation and Project Setup

### A1. Bootstrap repo baru

- Priority: `P0`
- User Story:
  - Sebagai tim developer, saya ingin project baru terpisah dari `mcgroup` agar pengembangan LevelUP adsPRO tidak tercampur dengan codebase utama yang sudah berjalan.
- Acceptance Criteria:
  - repo baru dibuat
  - README awal tersedia
  - struktur folder frontend, backend, worker, infra jelas
  - environment local development bisa dijalankan

### A2. Siapkan Docker Compose local stack

- Priority: `P0`
- User Story:
  - Sebagai developer, saya ingin seluruh dependency inti bisa dijalankan lokal agar onboarding tim lebih cepat.
- Acceptance Criteria:
  - service `web`, `api`, `worker`, `postgres`, `redis`, `minio` tersedia
  - satu command untuk start local stack tersedia
  - variabel environment terdokumentasi

### A3. Siapkan CI dasar

- Priority: `P1`
- User Story:
  - Sebagai developer, saya ingin lint dan test dasar berjalan otomatis agar kualitas kode terjaga sejak awal.
- Acceptance Criteria:
  - lint frontend dan backend dapat dijalankan
  - unit test basic bisa dijalankan di pipeline
  - failure pipeline memblok merge

## 5. Epic B - Authentication and Multi-Tenant Core

### B1. Signup dan login user

- Priority: `P0`
- User Story:
  - Sebagai calon user, saya ingin membuat akun dan login agar bisa mulai memakai platform.
- Acceptance Criteria:
  - user bisa signup dengan email dan password
  - user bisa login dan logout
  - session atau token tersimpan aman
  - pesan error login jelas

### B2. Create organization

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin membuat organization agar toko dan team saya terpisah dari tenant lain.
- Acceptance Criteria:
  - organization bisa dibuat setelah signup
  - owner otomatis menjadi member pertama
  - semua data organization di-scope ke tenant yang benar

### B3. Invite team member

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin mengundang manager atau staff agar mereka bisa membantu memonitor ads.
- Acceptance Criteria:
  - owner bisa mengundang user via email
  - role dapat dipilih saat invite
  - invited user dapat menerima dan bergabung

### B4. Role-based access

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin role membatasi akses agar billing dan setting sensitif tidak diubah sembarang user.
- Acceptance Criteria:
  - role `owner`, `manager`, `staff` tersedia
  - akses halaman dan API dibatasi sesuai role
  - unauthorized access ditolak

## 6. Epic C - Subscription and Entitlement

### C1. Seed subscription plans

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin mengenal plan `Free`, `Starter`, `Pro`, dan `Agency` agar fitur bisa dibatasi sejak awal.
- Acceptance Criteria:
  - plans tersimpan di database
  - limit shop, retention, AI access, seat limit tersimpan

### C2. Attach subscription ke organization

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin organization saya memiliki plan aktif agar fitur yang tersedia sesuai paket.
- Acceptance Criteria:
  - organization memiliki subscription aktif
  - status subscription dapat dibaca dari backend dan frontend

### C3. Enforce entitlement

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin limit plan benar-benar ditegakkan agar bisnis model berjalan.
- Acceptance Criteria:
  - batas jumlah shop dicek
  - batas history retention dicek
  - fitur AI basic hanya aktif bila plan mengizinkan

### C4. Upgrade atau downgrade plan

- Priority: `P1`
- User Story:
  - Sebagai owner, saya ingin mengganti plan agar kapasitas dan fitur organisasi bisa naik atau turun.
- Acceptance Criteria:
  - owner dapat mengganti plan
  - perubahan plan tercatat
  - entitlement baru segera berlaku

## 7. Epic D - Shop and Marketplace Connection

### D1. Tambah shop Shopee

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin menambahkan shop Shopee agar sistem bisa mengaitkan data ads ke tenant saya.
- Acceptance Criteria:
  - shop Shopee dapat dibuat
  - nama shop dan external identifier tersimpan
  - shop muncul di dashboard tenant

### D2. Tambah shop TikTok Shop

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin menambahkan shop TikTok Shop agar kedua marketplace fase awal didukung.
- Acceptance Criteria:
  - shop TikTok Shop dapat dibuat
  - marketplace relation tersimpan benar

### D3. Shop sync health

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin melihat status sync tiap shop agar saya tahu apakah data masih segar.
- Acceptance Criteria:
  - ada `last sync`, `last success`, `last fail`
  - status health tampil di UI

## 8. Epic E - Chrome Extension

### E1. Login extension

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin login di extension agar data yang saya capture terhubung ke organization yang benar.
- Acceptance Criteria:
  - extension bisa login ke akun SaaS
  - token atau session extension tervalidasi
  - logout extension tersedia

### E2. Detect active shop

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin extension mengenali shop aktif di dashboard marketplace agar data tidak salah tenant atau salah shop.
- Acceptance Criteria:
  - shop detection berjalan pada Shopee
  - shop detection berjalan pada TikTok Shop
  - hasil detection dikirim bersama payload

### E3. Manual sync ads data

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin menekan tombol sync manual agar saya bisa segera memperbarui data saat dibutuhkan.
- Acceptance Criteria:
  - manual sync tersedia di extension
  - status loading dan hasil sync terlihat
  - error sync dapat dilihat user

### E4. Auto sync saat dashboard dibuka

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin sync berjalan otomatis saat membuka dashboard marketplace agar data lebih up to date tanpa effort manual.
- Acceptance Criteria:
  - auto sync bisa trigger saat page relevan dibuka
  - ada throttling agar tidak spam request
  - duplicate capture dicegah

### E5. Background retry queue

- Priority: `P1`
- User Story:
  - Sebagai user, saya ingin payload yang gagal terkirim bisa dicoba lagi agar data tidak mudah hilang saat koneksi buruk.
- Acceptance Criteria:
  - retry queue lokal tersedia
  - payload gagal tidak hilang langsung
  - retry punya batas yang jelas

## 9. Epic F - Ingestion and Raw Data

### F1. Ingestion endpoint

- Priority: `P0`
- User Story:
  - Sebagai extension, saya ingin mengirim payload ke backend agar data bisa diproses lebih lanjut.
- Acceptance Criteria:
  - endpoint menerima payload Shopee dan TikTok Shop
  - tenant dan shop tervalidasi
  - response success atau failure konsisten

### F2. Idempotency and dedupe

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin duplicate payload tidak memicu proses ganda agar metrics tetap akurat.
- Acceptance Criteria:
  - idempotency key disimpan
  - duplicate payload dikenali
  - processing ganda dicegah

### F3. Raw snapshot storage

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin menyimpan payload mentah agar bisa audit dan replay saat parser berubah.
- Acceptance Criteria:
  - payload mentah tersimpan ke object storage
  - hash payload tersimpan
  - metadata batch dapat ditelusuri

### F4. Ingestion log viewer

- Priority: `P1`
- User Story:
  - Sebagai internal admin, saya ingin melihat log ingestion agar debugging lebih cepat.
- Acceptance Criteria:
  - batch ingestion dapat dicari
  - status sukses atau gagal terlihat
  - error message terbaca

## 10. Epic G - Normalization and Analytics Processing

### G1. Normalize Shopee ads payload

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin data Shopee dinormalisasi agar analytics bisa dihitung dengan struktur seragam.
- Acceptance Criteria:
  - entitas campaign, product, metrics dasar tersusun
  - field penting terpetakan

### G2. Normalize TikTok Shop ads payload

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin data TikTok Shop dinormalisasi dengan cara yang konsisten.
- Acceptance Criteria:
  - campaign, product, dan metrics dasar bisa dipetakan
  - struktur normalized sesuai contract internal

### G3. Build daily metrics aggregator

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin melihat metrik harian agar performa ads mudah dipantau.
- Acceptance Criteria:
  - daily metrics tersimpan per shop dan object
  - revenue, spend, clicks, orders, ROAS tersedia

### G4. Build hourly metrics aggregator

- Priority: `P1`
- User Story:
  - Sebagai manager, saya ingin melihat granularitas lebih detail agar perubahan performa cepat terdeteksi.
- Acceptance Criteria:
  - hourly metrics tersedia untuk object utama
  - query masih performant

## 11. Epic H - Dashboard Overview

### H1. Overview KPI cards

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin melihat KPI utama dalam satu layar agar cepat memahami performa toko.
- Acceptance Criteria:
  - revenue
  - orders
  - ad spend
  - profit
  - ROAS
  - growth rate
  - period filter tersedia

### H2. Marketplace and shop filters

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin filter per marketplace dan shop agar analisa tidak tercampur.
- Acceptance Criteria:
  - filter shop tersedia
  - filter marketplace tersedia
  - filter date range tersedia

### H3. Data freshness indicator

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin tahu kapan data terakhir diperbarui agar saya paham apakah dashboard masih relevan.
- Acceptance Criteria:
  - last updated tampil
  - stale status diberi label

## 12. Epic I - Ads Analytics Module

### I1. Campaign performance table

- Priority: `P0`
- User Story:
  - Sebagai manager, saya ingin melihat daftar campaign dengan performanya agar saya cepat menemukan yang bagus dan yang rugi.
- Acceptance Criteria:
  - tabel campaign tampil
  - metric utama tampil
  - sorting dasar tersedia

### I2. Top and worst campaign widget

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin melihat campaign terbaik dan terburuk agar fokus evaluasi lebih cepat.
- Acceptance Criteria:
  - top campaign tampil
  - worst campaign tampil
  - ranking didasarkan pada metric yang jelas

### I3. Trend charts

- Priority: `P0`
- User Story:
  - Sebagai manager, saya ingin melihat tren spend, revenue, ROAS, dan profit agar bisa memahami arah performa.
- Acceptance Criteria:
  - chart spend tersedia
  - chart revenue tersedia
  - chart ROAS tersedia
  - chart profit tersedia

## 13. Epic J - Product and Shop Analytics

### J1. Product ranking

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin tahu produk mana yang paling baik dan paling lemah agar saya bisa memutuskan scale atau stop.
- Acceptance Criteria:
  - top product dan worst product tersedia
  - ROAS dan profit per product tampil

### J2. Fast and slow moving indicator

- Priority: `P1`
- User Story:
  - Sebagai owner, saya ingin melihat produk fast moving dan slow moving agar strategi promosi lebih tepat.
- Acceptance Criteria:
  - indikator tersedia
  - definisi perhitungan terdokumentasi

### J3. Shop comparison

- Priority: `P0`
- User Story:
  - Sebagai owner multi-shop, saya ingin membandingkan performa antar shop agar alokasi budget lebih efisien.
- Acceptance Criteria:
  - revenue, spend, profit per shop dapat dibandingkan
  - ranking shop tersedia

## 14. Epic K - Profit Engine

### K1. Shop profit settings

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin mengatur biaya dasar per shop agar profit yang dihitung lebih realistis.
- Acceptance Criteria:
  - admin fee, packaging, shipping subsidy, affiliate cost bisa diatur
  - perubahan tercatat

### K2. Product COGS override

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin mengisi COGS per product agar profit per produk tidak memakai asumsi rata-rata semua.
- Acceptance Criteria:
  - COGS per product dapat disimpan
  - override lebih prioritas dari default shop

### K3. Net profit calculation

- Priority: `P0`
- User Story:
  - Sebagai owner, saya ingin melihat net profit agar keputusan iklan tidak hanya berdasarkan omzet.
- Acceptance Criteria:
  - gross profit terhitung
  - net profit terhitung
  - profit margin tersedia

### K4. Break even ROAS calculator

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin melihat target ROAS impas agar setting iklan lebih tepat.
- Acceptance Criteria:
  - break even ROAS tampil per product atau campaign
  - sistem menandai jika biaya input belum lengkap

## 15. Epic L - Recommendation Engine

### L1. Rule engine v1

- Priority: `P0`
- User Story:
  - Sebagai sistem, saya ingin memproses rules bisnis agar rekomendasi bisa dihasilkan secara konsisten.
- Acceptance Criteria:
  - rules scale, pause, improve creative, improve PDP, reduce bid tersedia
  - severity dan confidence tersimpan

### L2. Recommendation list UI

- Priority: `P0`
- User Story:
  - Sebagai manager, saya ingin daftar rekomendasi yang sudah diprioritaskan agar saya tahu apa yang harus dikerjakan dulu.
- Acceptance Criteria:
  - daftar recommendation tersedia
  - filter by severity tersedia
  - evidence ringkas tampil

### L3. Accept or ignore recommendation

- Priority: `P1`
- User Story:
  - Sebagai user, saya ingin menandai rekomendasi sebagai diterima atau diabaikan agar sistem tahu respons saya.
- Acceptance Criteria:
  - user bisa accept atau ignore
  - status tersimpan

### L4. AI explanation layer

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin penjelasan singkat yang mudah dipahami agar tidak perlu membaca semua angka mentah.
- Acceptance Criteria:
  - setiap recommendation punya summary
  - summary tidak berdiri tanpa evidence

## 16. Epic M - Alerts

### M1. In-app alert center

- Priority: `P0`
- User Story:
  - Sebagai user, saya ingin melihat alert penting di aplikasi agar saya tahu kondisi yang butuh perhatian.
- Acceptance Criteria:
  - alert list tersedia
  - read or unread state tersedia

### M2. Email alert

- Priority: `P1`
- User Story:
  - Sebagai owner, saya ingin menerima email saat ada masalah besar agar saya tidak harus selalu membuka dashboard.
- Acceptance Criteria:
  - email trigger untuk negative profit, ROAS drop, abnormal spend tersedia
  - template email dasar tersedia

## 17. Epic N - Billing

### N1. Integrasi payment gateway dasar

- Priority: `P1`
- User Story:
  - Sebagai owner, saya ingin membayar subscription agar bisa upgrade plan.
- Acceptance Criteria:
  - satu payment gateway aktif
  - payment success mengaktifkan subscription

### N2. Invoice history

- Priority: `P1`
- User Story:
  - Sebagai owner, saya ingin melihat invoice sebelumnya agar pencatatan billing mudah.
- Acceptance Criteria:
  - daftar invoice tersedia
  - status invoice terbaca

## 18. Epic O - Internal Admin and Observability

### O1. Internal admin login

- Priority: `P1`
- User Story:
  - Sebagai operator internal, saya ingin masuk ke area admin agar bisa membantu support dan monitoring tenant.
- Acceptance Criteria:
  - role internal terpisah dari tenant role
  - tenant data tetap tidak bocor lintas tenant

### O2. Sync monitoring dashboard

- Priority: `P1`
- User Story:
  - Sebagai operator internal, saya ingin melihat sync failure agar support lebih cepat.
- Acceptance Criteria:
  - sync success rate tampil
  - ingestion failure terbaru tampil

### O3. Audit logs

- Priority: `P1`
- User Story:
  - Sebagai sistem, saya ingin mencatat perubahan sensitif agar insiden bisa ditelusuri.
- Acceptance Criteria:
  - perubahan role
  - perubahan plan
  - perubahan profit settings
  - perubahan shop connection tercatat

## 19. Epic P - Public Market Intelligence

### P1. Capture keyword search session

- Priority: `P1`
- User Story:
  - Sebagai user, saya ingin extension membaca hasil pencarian Shopee berdasarkan keyword tertentu agar saya bisa melakukan riset market tanpa harus connect toko.
- Acceptance Criteria:
  - extension mengenali halaman search publik Shopee
  - keyword aktif dapat dibaca
  - hasil pencarian dasar dapat ditangkap

### P2. Save keyword research result

- Priority: `P1`
- User Story:
  - Sebagai user, saya ingin menyimpan hasil riset keyword ke akun SaaS agar saya bisa meninjau ulang kandidat produk potensial.
- Acceptance Criteria:
  - hasil riset bisa disimpan saat user login ke sistem
  - record discope ke organization yang benar
  - histori session riset dapat ditelusuri

### P3. Normalize public search result

- Priority: `P1`
- User Story:
  - Sebagai sistem, saya ingin menormalisasi hasil pencarian publik agar data riset bisa dianalisis konsisten.
- Acceptance Criteria:
  - title produk tersimpan
  - price range tersimpan
  - sales hint tersimpan bila tersedia
  - ranking position tersimpan bila tersedia

### P4. Keyword research workspace

- Priority: `P2`
- User Story:
  - Sebagai user, saya ingin workspace khusus riset keyword agar saya bisa membandingkan hasil beberapa keyword tanpa membuka marketplace berulang kali.
- Acceptance Criteria:
  - daftar keyword tersimpan
  - hasil per keyword dapat dilihat kembali
  - filter marketplace dan tanggal tersedia

## 20. Sprint Suggestion

### Sprint 1

- A1
- A2
- B1
- B2

### Sprint 2

- B3
- B4
- C1
- C2
- D1
- D2

### Sprint 3

- C3
- D3
- E1
- E2
- E3
- F1

### Sprint 4

- E4
- F2
- F3
- G1
- G2

### Sprint 5

- G3
- H1
- H2
- H3
- I1

### Sprint 6

- I2
- I3
- J1
- J3
- K1

### Sprint 7

- K2
- K3
- K4
- L1
- L2

### Sprint 8

- L4
- M1
- C4
- N1

Item `P1` lain dikerjakan setelah MVP core stabil.

## 21. Catatan Implementasi

- Jika kapasitas tim kecil, fokus ke `P0` dahulu.
- `Hourly metrics`, `accept/ignore recommendation`, dan `email alert` bisa mundur jika core ingestion belum stabil.
- `AI chat analyst` sengaja tidak masuk backlog MVP ini.
- Jika perlu validasi market lebih cepat, billing bahkan bisa diaktifkan setelah private beta, bukan sebelum closed alpha.
- Epic `P` dapat diperlakukan sebagai gelombang terpisah karena tidak bergantung penuh pada connected shop.
