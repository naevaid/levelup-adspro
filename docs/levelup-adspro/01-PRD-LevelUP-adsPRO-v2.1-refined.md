# PRD - LevelUP adsPRO v2.1 Refined

## 1. Ringkasan Produk

`LevelUP adsPRO` adalah platform SaaS multi-tenant untuk seller marketplace Indonesia yang mengubah data iklan, penjualan, dan profit menjadi insight, rekomendasi, dan tindakan prioritas. Produk ini diposisikan bukan sebagai dashboard analytics biasa, tetapi sebagai `AI Marketplace Intelligence Platform`.

Fokus fase awal:

- Shopee
- TikTok Shop
- Chrome Extension sebagai collector
- Dashboard web untuk analytics dan profit
- Recommendation engine berbasis rules + AI explanation
- Billing subscription

## 2. Visi Produk

Menjadi asisten analyst untuk seller marketplace yang:

- mengumpulkan data secara otomatis
- mengolah data menjadi business metrics
- mendeteksi masalah dan peluang
- memberi rekomendasi yang bisa langsung ditindaklanjuti

Produk harus membantu seller mengambil keputusan lebih cepat tanpa bergantung pada ekspor Excel, hitung manual, atau monitoring kampanye satu per satu.

## 3. Positioning

### Bukan

- dashboard iklan biasa
- tools ROAS sederhana
- tools ekspor data

### Adalah

- AI marketplace intelligence platform
- profit-first ads decision system
- command center untuk performa toko, kampanye, dan produk

## 4. Problem Statement

Seller marketplace saat ini mengalami beberapa masalah utama:

- data iklan tersebar di dashboard marketplace dan sulit diringkas
- seller kesulitan menentukan target ROAS yang realistis per produk
- omzet terlihat tinggi tetapi profit tidak jelas
- evaluasi ratusan campaign memakan waktu lama
- keputusan scale atau pause campaign sering dilakukan tanpa evidence
- owner sulit memantau banyak toko dan banyak staff dalam satu tempat

## 5. Target User

### Primary User

- owner brand atau owner toko marketplace
- manager performance marketing
- operator ads internal
- seller yang aktif beriklan di Shopee atau TikTok Shop

### Secondary User

- agency yang mengelola banyak client marketplace
- finance atau analyst yang ingin melihat profit riil

## 6. Role dan Permission Model

### Owner

- full access organisasi
- kelola billing
- kelola shop
- kelola team
- lihat semua analytics
- atur profit rules dan alert rules

### Manager

- akses analytics dan AI recommendation
- kelola team sesuai scope organisasi
- kelola shop connection bila diizinkan owner

### Staff

- view analytics
- manual sync
- lihat rekomendasi
- tidak bisa mengubah billing dan permission sensitif

### Agency

- akses multi-client berdasarkan organization terpisah
- white label dan API access hanya untuk plan tertentu, bukan MVP

### Admin Internal

- role internal operator platform
- khusus backoffice SaaS
- tidak terlihat oleh tenant

## 7. Business Model

Model monetisasi:

- monthly subscription
- yearly subscription

Rencana plan:

- `Free`: 1 shop, history 7 hari, basic analytics
- `Starter`: 3 shop, history 90 hari, AI recommendation
- `Pro`: 10 shop, unlimited history, AI analyst, team member, alert
- `Agency`: unlimited shop, unlimited user, white label, API access

Catatan produk:

- subscription melekat ke `organization`, bukan ke user
- limit shop, seat, data retention, dan fitur AI ditentukan per plan

## 8. Definisi Entitas Utama

### Organization

Tenant utama dalam sistem. Satu organization memiliki:

- banyak user
- banyak shop
- satu subscription aktif
- satu kumpulan pengaturan profit dan alert

### Shop

Representasi satu toko marketplace yang terhubung ke satu organization.

### Marketplace Connection

Koneksi aktif antara extension, marketplace, dan akun SaaS untuk satu shop.

### Seat

User aktif yang menjadi anggota organization dan memakai sistem.

## 9. Value Proposition

Seller tidak perlu lagi:

- ekspor data manual
- menghitung ROAS impas dengan spreadsheet
- mengecek satu per satu campaign yang rugi
- menggabungkan data iklan dengan profit secara manual

Platform akan:

- mengambil data dari dashboard marketplace
- mengambil data publik marketplace untuk riset market
- menyimpan data mentah dan hasil agregasi
- menghitung metric bisnis dan profit
- memberi rekomendasi prioritas dengan evidence

## 10. Data Acquisition Modes

Produk ini harus dipahami memiliki dua jalur data yang berbeda.

### 10.1 Connected Shop Mode

Dipakai untuk data toko milik user sendiri.

Karakteristik:

- perlu login akun SaaS
- perlu connect shop atau session extension yang terkait ke shop user
- membaca dashboard seller, dashboard ads, atau sumber internal toko
- dipakai untuk analytics, profit, ROAS, recommendation, dan alert toko sendiri

Contoh use case:

- evaluasi campaign
- target ROAS per produk
- profit analytics
- scale atau pause recommendation

### 10.2 Public Market Intelligence Mode

Dipakai untuk riset market dan kompetitor tanpa harus connect toko sendiri.

Karakteristik:

- tidak wajib login toko marketplace
- cukup login ke akun sistem jika user ingin menyimpan hasil riset
- extension membaca halaman pencarian marketplace, listing publik, dan elemen yang tersedia di web publik
- dipakai untuk riset produk hero, tren keyword, rentang harga, dan pengamatan kompetitor

Contoh use case:

- user mencari keyword tertentu di web Shopee
- extension membaca hasil pencarian
- extension menangkap data produk, range harga, dan data penjualan yang terlihat
- hasil riset dapat disimpan ke akun SaaS bila user menginginkannya

Catatan:

- `Connected Shop Mode` dan `Public Market Intelligence Mode` harus dipisahkan secara konsep, pipeline data, dan hak akses
- fitur market intelligence tidak boleh bergantung pada keberhasilan connect shop

## 11. Cakupan Marketplace Phase 1

### Shopee

- campaign
- product ads
- keyword ads
- GMV Max
- shop ads

### TikTok Shop

- campaign
- product ads
- GMV ads
- live ads
- video ads

## 12. User Journey Inti

1. User daftar akun SaaS
2. User membuat atau bergabung ke organization
3. User install Chrome extension
4. User login ke extension
5. User connect shop marketplace
6. User membuka dashboard ads marketplace
7. Extension membaca data yang dibutuhkan
8. Data dikirim ke API ingestion
9. Sistem menyimpan raw snapshot
10. Engine analytics membentuk metrik harian dan per campaign
11. Profit engine menghitung profit dan target ROAS
12. AI engine memberi diagnosis dan rekomendasi
13. Dashboard menampilkan insight dan alert

### User Journey Alternatif untuk Market Intelligence

1. User daftar atau login ke akun SaaS
2. User install Chrome extension
3. User membuka web pencarian Shopee dengan keyword tertentu
4. Extension membaca hasil pencarian dan data publik yang terlihat
5. Extension menangkap keyword, produk, range harga, dan sinyal penjualan yang tersedia
6. User menyimpan hasil riset ke akun SaaS
7. Sistem menampilkan hasil riset dan kandidat produk potensial

## 13. Modul Produk

### 13.1 Overview Dashboard

Menampilkan KPI ringkas lintas shop dan lintas marketplace:

- revenue
- orders
- ad spend
- profit
- ROAS
- CTR
- CVR
- AOV
- growth rate
- net margin

### 13.2 Ads Analytics

- campaign performance
- top campaign
- worst campaign
- trend spend
- trend revenue
- trend ROAS
- trend profit
- filter per shop, marketplace, date range, campaign type

### 13.3 Profit Analytics

Input utama:

- COGS
- shipping subsidy
- marketplace fee
- admin fee
- packaging cost
- affiliate cost

Output utama:

- gross profit
- net profit
- profit margin
- break even ROAS

### 13.4 Product Analytics

- top product
- worst product
- profit per product
- ROAS per product
- fast moving product
- slow moving product
- inventory risk placeholder untuk fase lanjutan

### 13.5 Shop Analytics

- performa antar shop
- ranking shop
- spend vs revenue vs profit per shop
- sync status per shop

### 13.6 Market Intelligence

- keyword research
- hero product discovery
- price range observation
- competitor listing observation
- saved research session

### 13.7 AI Analyst

Hasil AI harus selalu berbentuk:

- diagnosis
- evidence
- recommendation
- confidence
- expected impact
- priority

### 13.8 Team Management

- undang user
- atur role
- atur akses organization
- audit basic activity

### 13.9 Billing

- subscription plan
- invoice
- payment history
- renewal status

## 14. Chrome Extension Requirements

Peran extension pada fase awal adalah `data collector`, bukan business logic utama.

Fitur minimum:

- login ke akun SaaS
- session verification
- shop detection
- manual sync
- auto sync saat dashboard dibuka
- background sync terbatas
- data encryption saat transmit
- retry queue sederhana
- capture mode untuk owned data dan public market intelligence

Batasan:

- extension tidak menjadi tempat analitik permanen
- extension hanya bertugas capture, normalize ringan, dan kirim payload
- extension harus dapat membedakan capture halaman seller/dashboard dengan capture halaman publik marketplace

## 15. Data dan Sync Requirements

### Freshness Target

- dashboard utama: target data tampil maksimal `15-30 menit` dari sync terakhir
- data campaign aktif: idealnya `<= 15 menit`
- data profit agregat: `<= 30 menit`

### Status Sync

Setiap shop harus memiliki:

- last sync at
- last successful sync at
- last failed sync at
- sync source: manual atau auto
- sync health status

### Retry Policy

- retry otomatis untuk kegagalan jaringan ringan
- lock untuk mencegah duplicate processing
- idempotency key untuk payload capture

### Market Research Storage

Untuk `Public Market Intelligence Mode`, sistem harus mendukung:

- penyimpanan hasil riset keyword
- penyimpanan snapshot pencarian
- tagging keyword potensial
- histori riset per user atau organization

## 16. Profit Model Requirements

Karena insight produk harus berorientasi profit, sistem wajib mendukung:

- default cost per shop
- override cost per product
- perubahan cost per periode
- pengaturan fee per marketplace
- pengaturan biaya tambahan manual

Jika sebagian input profit belum lengkap, sistem harus:

- menandai metric sebagai estimasi
- menjelaskan komponen yang belum tersedia
- tidak menyajikan profit seolah pasti final

## 17. AI Layer Strategy

MVP tidak boleh mengandalkan LLM murni untuk keputusan inti.

### Rule-Based Layer

Menangani:

- scale recommendation
- pause recommendation
- low CTR warning
- low CVR warning
- high CPC warning
- negative profit warning
- target ROAS gap

### LLM Layer

Menangani:

- penjelasan naratif
- ringkasan temuan
- prioritas aksi
- jawaban analyst-style berdasarkan metric yang sudah dihitung

### Prinsip AI

- rekomendasi harus punya evidence
- sumber angka harus bisa diaudit
- AI explanation tidak boleh menutupi rule asli

## 18. Recommendation Engine

Contoh rule awal:

- jika ROAS > target dan profit positif -> `scale`
- jika profit negatif -> `pause`
- jika CTR rendah -> `improve creative`
- jika CVR rendah -> `improve PDP`
- jika CPC tinggi -> `reduce bid`
- jika spend naik tetapi revenue stagnan -> `review targeting`

Setiap recommendation minimal menyimpan:

- recommendation type
- object type
- object id
- evidence snapshot
- rule version
- severity
- status accepted atau ignored

## 19. Alert System

Channel jangka pendek untuk MVP:

- in-app
- email

Channel fase berikutnya:

- Telegram
- WhatsApp

Alert utama:

- budget running out
- profit negative
- campaign winning
- ROAS drop
- revenue drop
- abnormal spend

## 20. Billing Requirements

Payment gateway kandidat:

- Midtrans
- Xendit

Fitur awal:

- monthly plan
- yearly plan
- auto renewal flag
- invoice
- tax invoice placeholder

Catatan:

- billing engine tidak perlu rumit di MVP
- fokus pada subscription activation, renewal status, dan entitlement

## 21. Success Metrics

### Product KPI

- connected shops
- active shops
- sync success rate
- recommendation acceptance rate
- weekly active organizations
- AI usage rate
- saved research sessions
- tracked keywords

### Business KPI

- MRR
- ARR
- churn rate
- paid conversion rate
- retention 30/90 hari

## 22. MVP Scope Final

Item wajib MVP:

- multi-tenant organization
- auth dan role dasar
- Shopee + TikTok Shop ingestion via extension
- public market intelligence capture untuk keyword search Shopee sebagai kandidat MVP+
- raw data storage
- overview dashboard
- ads analytics dasar
- profit analytics dasar
- recommendation engine berbasis rules
- AI explanation dasar
- subscription system dasar
- email dan in-app alert dasar

Item non-MVP:

- competitor tracking
- industry benchmark
- WhatsApp alert
- AI chat analyst penuh
- API publik
- white label
- cross-marketplace benchmark lanjut

Catatan:

- `public market intelligence capture` boleh masuk setelah core connected shop stabil
- jika resource tim terbatas, fitur ini bisa ditempatkan sebagai gelombang setelah MVP core

## 23. Risiko dan Constraint

### Risiko Teknis

- perubahan UI marketplace dapat memutus flow capture extension
- session marketplace dapat expired sewaktu-waktu
- payload yang ditangkap bisa berubah format

### Risiko Produk

- user menganggap revenue sama dengan profit
- user memasukkan COGS yang salah
- user mengharapkan AI memberi keputusan final otomatis

### Risiko Legal dan Operasional

- metode capture data harus mengikuti batas operasional yang aman
- data toko dan session harus dienkripsi
- audit trail diperlukan untuk perubahan sensitif

## 24. Non-Functional Requirements

- SaaS multi-tenant dengan isolasi data per organization
- audit log untuk aksi sensitif
- encryption in transit dan at rest untuk data sensitif
- monitoring basic untuk API, queue, sync job, dan database
- backup database harian
- observability untuk ingestion failures
- retention policy raw data sesuai plan

## 25. Roadmap Fase Produk

### Phase 1

- Shopee
- TikTok Shop
- extension
- dashboard
- profit analytics
- AI recommendation
- subscription system

### Phase 2

- AI chat analyst
- WhatsApp alert
- competitor tracking
- benchmark industry
- market research workspace yang lebih lengkap

### Phase 3

- auto campaign audit
- auto bid suggestion
- AI forecasting
- AI revenue prediction

### Phase 4

- Tokopedia
- Lazada
- Blibli

## 26. Future Moat

- data historis lintas shop dan lintas marketplace
- recommendation model berbasis perilaku tenant
- benchmark marketplace dan industry
- cross-marketplace intelligence
- agency ecosystem
- keyword intelligence dan riset historis publik

## 27. Recommended Tech Direction

Untuk MVP, arsitektur yang direkomendasikan adalah `modular monolith`, bukan microservices penuh.

Stack awal:

- Frontend: Next.js
- Backend: NestJS
- Database: PostgreSQL
- Cache: Redis
- Queue: BullMQ
- AI: OpenAI
- Storage: MinIO
- Monitoring: Grafana
- Deployment: Docker, Ubuntu VPS

Alasan:

- lebih cepat dibangun
- lebih murah dioperasikan di VPS
- lebih mudah debug
- masih mudah dipecah menjadi service terpisah saat scale

## 28. Target Scale

### Year 1

- 500 seller
- 5 juta rows data

### Year 2

- 5.000 seller
- 100 juta rows data

### Year 3

- 20.000 seller
- 1 miliar rows data

## 29. Open Questions

- model onboarding shop paling ringan untuk non-technical seller seperti apa
- apakah agency memakai tenant terpisah per client atau satu super-tenant
- pricing final untuk seat tambahan dan shop tambahan
- kebutuhan profit input per product vs bulk import CSV
- batas aman frekuensi sync dari extension untuk setiap marketplace
- kapan AI chat analyst layak masuk setelah MVP tervalidasi
- apakah hasil riset keyword publik disimpan per user, per organization, atau keduanya
- metrik publik apa saja yang paling stabil untuk dijadikan sinyal hero product
