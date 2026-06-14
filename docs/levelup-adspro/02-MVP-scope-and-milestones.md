# LevelUP adsPRO - MVP Scope and Milestones

## 1. Tujuan Dokumen

Dokumen ini memecah PRD `LevelUP adsPRO` menjadi scope MVP yang tajam, milestone implementasi, dan definisi keluarannya. Targetnya adalah membantu tim build dengan urutan yang realistis untuk produk SaaS baru yang terpisah dari `mcgroup`.

## 2. Prinsip MVP

MVP harus membuktikan 4 value utama:

- seller bisa tahu campaign mana yang rugi
- seller bisa tahu produk mana yang layak di-scale
- seller bisa tahu target ROAS yang masuk akal
- seller bisa tahu profit riil, bukan omzet semu

Semua fitur yang tidak mendukung empat hasil ini secara langsung harus ditunda.

## 3. Scope MVP Wajib

### 3.1 Tenant dan Auth

- signup dan login akun SaaS
- create organization
- invite member
- role dasar: owner, manager, staff
- subscription entitlement dasar per organization

### 3.2 Shop Connection

- registrasi shop Shopee
- registrasi shop TikTok Shop
- link shop ke organization
- status connection dan sync health

### 3.3 Chrome Extension

- login ke SaaS
- deteksi shop aktif
- kirim capture data ads
- manual sync
- auto sync saat halaman dashboard marketplace dibuka
- retry sederhana

### 3.4 Ingestion dan Storage

- terima raw payload dari extension
- validasi tenant dan shop
- simpan raw snapshot
- dedupe payload
- enqueue analytics job

### 3.5 Analytics Dashboard

- overview dashboard
- ads analytics dasar
- product analytics dasar
- shop analytics dasar

### 3.6 Profit Engine

- input COGS
- input biaya tambahan
- marketplace fee default
- hitung gross profit
- hitung net profit
- hitung target ROAS / break even ROAS

### 3.7 Recommendation Engine

- rules untuk scale, pause, improve creative, improve PDP, reduce bid
- severity dan priority
- evidence snapshot
- AI explanation singkat

### 3.8 Alert Dasar

- in-app alert
- email alert

### 3.9 Billing Dasar

- pilih plan
- aktifkan subscription
- cek entitlement feature
- riwayat invoice sederhana

## 4. Out of Scope MVP

- AI chat analyst penuh
- WhatsApp alert
- Telegram alert
- competitor tracking
- benchmark industry
- public API
- white label
- advanced anomaly detection model
- automated action execution ke marketplace

## 5. MVP Use Cases yang Harus Sukses

### Use Case 1

Owner memiliki 1 shop Shopee, menginstal extension, lalu melihat dashboard ringkas performa iklan dalam hari yang sama.

### Use Case 2

Owner memasukkan COGS dan biaya dasar produk, lalu sistem menampilkan profit dan break even ROAS.

### Use Case 3

Manager membuka daftar campaign dan langsung melihat campaign yang perlu di-pause atau di-scale beserta alasan.

### Use Case 4

Owner menerima alert saat profit campaign negatif atau ROAS turun di bawah target.

### Use Case 5

Organization upgrade dari `Free` ke `Starter`, lalu limit shop dan AI recommendation ikut aktif.

## 6. Milestone Implementasi

## Milestone 0 - Foundation

### Outcome

Lingkungan proyek baru siap dikembangkan secara terpisah dari `mcgroup`.

### Deliverables

- repo baru
- Docker Compose local dev
- Next.js app shell
- NestJS API shell
- PostgreSQL
- Redis
- MinIO
- auth dasar
- organization table dan membership
- observability minimal

### Exit Criteria

- user bisa login
- organization bisa dibuat
- app lokal dan staging bisa hidup stabil

## Milestone 1 - Tenant, Shop, Subscription Core

### Outcome

Sistem mengenal tenant, user, role, shop, dan plan.

### Deliverables

- organization management
- role dasar
- subscription plan
- entitlement check
- shop registry
- shop sync health status

### Exit Criteria

- satu organization bisa punya beberapa user dan beberapa shop
- sistem bisa membatasi jumlah shop berdasarkan plan

## Milestone 2 - Extension to Ingestion

### Outcome

Extension bisa mengirim raw data marketplace ke backend secara aman.

### Deliverables

- auth extension
- shop detection
- payload schema versioning
- raw payload ingestion endpoint
- idempotency key
- retry dan queue job dasar

### Exit Criteria

- sync manual berhasil untuk minimal 1 flow Shopee dan 1 flow TikTok Shop
- raw payload tersimpan dan bisa ditelusuri

## Milestone 3 - Analytics Core

### Outcome

Data mentah berhasil diolah menjadi metrik bisnis dasar.

### Deliverables

- data normalization
- daily metrics
- campaign metrics
- product metrics
- shop metrics
- overview dashboard
- ads analytics dasar

### Exit Criteria

- dashboard dapat menampilkan revenue, spend, ROAS, orders, CTR, CVR
- filter per shop dan marketplace berjalan

## Milestone 4 - Profit Engine

### Outcome

Sistem bisa memproyeksikan profit riil berdasarkan biaya yang diinput user.

### Deliverables

- COGS settings
- fee settings
- packaging dan biaya tambahan
- profit calculator
- break even ROAS calculator

### Exit Criteria

- dashboard bisa menampilkan gross profit, net profit, margin
- product dan campaign bisa diklasifikasikan untung atau rugi

## Milestone 5 - Recommendation Engine

### Outcome

Sistem memberi rekomendasi yang bisa ditindaklanjuti.

### Deliverables

- rule engine v1
- severity model
- evidence snapshot
- AI explanation v1
- recommendation list
- accepted / ignored state

### Exit Criteria

- user dapat melihat alasan jelas kenapa campaign harus scale atau pause
- rekomendasi punya evidence dan tidak bergantung pada LLM murni

## Milestone 6 - Alerts and Billing

### Outcome

Sistem siap dipakai tenant berbayar dengan alert dasar.

### Deliverables

- in-app alert
- email alert
- Midtrans atau Xendit integration dasar
- invoice sederhana
- plan upgrade/downgrade flow

### Exit Criteria

- tenant bisa upgrade plan
- alert penting bisa terkirim

## 7. Rencana Beta Launch

### Closed Alpha

- 3 sampai 5 seller terdekat
- fokus validasi raw capture dan metrik dasar

### Private Beta

- 10 sampai 20 seller
- fokus validasi profit analytics dan recommendation usefulness

### Public Beta

- self-serve onboarding terbatas
- mulai aktifkan billing plan dasar

## 8. KPI Validasi MVP

### Product Signal

- 70% shop berhasil sync minimal 1 kali per hari
- 50% organization membuka dashboard minimal 3 kali per minggu
- 30% rekomendasi ditandai useful atau accepted
- waktu evaluasi campaign turun signifikan dibanding manual

### Business Signal

- minimal 10 tenant aktif dalam private beta
- conversion dari `Free` ke paid plan mulai terbukti
- churn early beta dapat dijelaskan dengan jelas

## 9. Backlog Prioritas Tinggi Setelah MVP

- AI chat analyst
- anomaly detection yang lebih baik
- competitor tracking
- benchmark antar tenant anonim
- WhatsApp alert
- agency workspace

## 10. Decision Log Awal

- backend MVP memakai modular monolith, bukan microservices
- AI recommendation MVP memakai rules + LLM explanation
- kanal alert MVP fokus ke in-app dan email
- support marketplace MVP dibatasi ke Shopee dan TikTok Shop
- competitor intelligence dan benchmark ditunda sampai core analytics stabil
