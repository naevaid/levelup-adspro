# LevelUP adsPRO - QA, Testing, and Release Checklist v1

## 1. Tujuan

Dokumen ini mendefinisikan strategi QA, testing, dan release checklist awal untuk `LevelUP adsPRO` agar pengembangan MVP tetap cepat tetapi tidak kehilangan kontrol kualitas.

Tujuan utamanya:

- mengurangi regresi pada fitur inti
- memastikan flow multi-tenant aman
- memastikan data analytics dan recommendation tidak menyesatkan
- menyiapkan pola release yang cukup aman untuk fase awal

## 2. Prinsip QA

- uji flow kritis, bukan semua hal secara berlebihan
- prioritaskan test yang melindungi logic bisnis utama
- bedakan antara validasi UI, validasi backend, dan validasi data pipeline
- gunakan data quality badge dan empty states sebagai bagian dari QA, bukan detail kosmetik
- setiap release harus memiliki checklist minimum sebelum dipromosikan

## 3. Testing Pyramid yang Disarankan

### Unit Test

Dipakai untuk:

- formula metrics
- recommendation rules
- permission checks
- profit calculation

### Integration Test

Dipakai untuk:

- auth + memberships
- shops + subscriptions
- extension session + ingestion batch
- analytics + profit + recommendations

### End-to-End atau Flow Test

Dipakai untuk:

- signup sampai dashboard awal
- add shop
- extension login
- ingestion accepted
- recommendation list muncul

## 4. Test Scope per Domain

## 4.1 Auth and Membership

Yang wajib diuji:

- signup membuat user dan organization pertama
- login mengembalikan context tenant aktif
- invite member berhasil dan token valid
- role change mengikuti permission
- membership inactive tidak bisa akses tenant app

## 4.2 Subscription and Entitlement

Yang wajib diuji:

- plan limit shop
- plan limit member
- feature gating market research atau AI recommendation
- downgrade tidak merusak data historis

## 4.3 Shops and Connections

Yang wajib diuji:

- create shop hanya untuk tenant valid
- shop tenant lain tidak bisa diakses
- connection health tampil benar
- sync manual tidak lolos jika permission tidak cukup

## 4.4 Extension and Ingestion

Yang wajib diuji:

- extension login valid
- heartbeat memperbarui session
- ingestion batch valid diterima
- payload invalid ditolak dengan error code jelas
- duplicate payload tidak diproses berulang

## 4.5 Analytics and Profit

Yang wajib diuji:

- aggregate harian terbentuk dari payload valid
- formula CTR, CVR, CPC, CPM, AOV, ROAS benar
- profit snapshot menandai `estimated` bila cost tidak lengkap
- dashboard overview tidak membaca raw payload langsung

## 4.6 Recommendations

Yang wajib diuji:

- rule `pause` muncul saat profit negatif
- rule `scale` muncul saat ROAS sehat dan profit positif
- data tidak cukup menghasilkan `watch` atau `insufficient_data`
- recommendation deduplication bekerja
- recommendation action mengubah status dengan benar

## 4.7 Market Research

Yang wajib diuji:

- session keyword research tersimpan
- hasil riset terikat ke organization
- saved research bisa dibaca ulang
- market research tidak bercampur dengan owned analytics

## 4.8 Alerts and Audit

Yang wajib diuji:

- alert severity tercatat benar
- mark read bekerja
- audit log tercatat untuk operasi sensitif

## 5. Test Types yang Direkomendasikan

### Logic Tests

Fokus pada:

- formula
- rules
- evaluasi threshold

### Contract Tests

Fokus pada:

- API response shape
- dashboard data contract
- permission error contract

### Migration Tests

Fokus pada:

- migration up sukses
- seeders sukses
- migration order valid

### UI Tests

Fokus pada:

- route guard
- empty state
- access denied
- data quality badge

## 6. Minimum Automated Test Priorities

Automated test prioritas tinggi:

- auth session flow
- membership role checks
- ingestion envelope validator
- metrics formula calculator
- recommendation rule evaluator
- profit completeness flag
- tenant ownership guard

Automated test prioritas menengah:

- dashboard overview read model
- market research session flow
- alert read flow

Automated test prioritas rendah pada MVP awal:

- visual detail pixel-perfect
- exhaustive UI snapshot untuk semua halaman

## 7. Manual QA Checklist per Sprint

Setiap akhir sprint, minimal cek manual:

1. login sebagai owner
2. login sebagai staff
3. cek menu berbeda sesuai role
4. cek empty state untuk tenant baru
5. cek dashboard dengan data ada
6. cek recommendation list dan detail
7. cek market research session list
8. cek access denied saat membuka route yang tidak boleh
9. cek extension login dan session heartbeat
10. cek halaman produk Shopee publik dan buka `Kalkulator ROAS`
11. cek auto-saran kategori dan fallback picker manual
12. cek deploy release dilakukan manual dan operator melihat hasil verifikasi

## 8. Test Data Strategy

Sistem sebaiknya punya tiga kelompok data:

### Demo Tenant

Untuk:

- UI development
- screenshot
- smoke test cepat

### Clean Tenant

Untuk:

- empty state
- onboarding flow
- permission flow

### Dirty or Edge Tenant

Untuk:

- partial sync
- missing cost
- stale data
- failed ingestion

## 9. Recommended Test Fixtures

Fixture minimum:

- 1 owner
- 1 manager
- 1 staff
- 1 organization dengan shop Shopee
- 1 shop tanpa data
- 1 shop dengan owned data
- 1 tenant dengan market research sessions
- 1 tenant dengan recommendations severity campuran

## 10. Regression Hotspots

Area yang paling rawan regresi:

- tenant scoping
- plan quota enforcement
- ingestion validator
- recommendation rule changes
- profit calculation
- dashboard read model
- permission-based navigation

## 11. Release Levels

### Local Development

Tujuan:

- validasi build dan flow dasar

### Internal Staging

Tujuan:

- validasi integration test
- validasi seeding
- validasi dashboard dan permission flow

### Limited Beta

Tujuan:

- validasi data nyata terbatas
- observasi sync, recommendation noise, dan usability

## 12. Pre-Release Checklist

Sebelum release, pastikan:

- migration berhasil di environment target
- seeder penting tidak rusak
- env variables lengkap
- queue dan Redis aktif
- object storage bisa diakses
- dashboard overview load
- login owner berhasil
- login staff berhasil
- permission guard bekerja
- ingestion endpoint merespons benar
- error logs tidak menunjukkan crash baru
- deploy dilakukan manual, bukan lewat timer/polling
- hasil `docker compose ... ps` dan endpoint publik dicek setelah deploy

## 13. Release Checklist untuk Backend

- jalankan migration
- validasi seeder atau reference data
- cek health endpoint
- cek queue worker aktif
- cek storage credentials valid
- cek billing webhook route jika ada perubahan

## 14. Release Smoke Checklist untuk Extension dan Manual Deploy

- build extension berhasil dari `apps/extension`
- ZIP package terbaru terbentuk di `apps/extension/package`
- popup login extension berhasil membuat `auth session` dan `extension session`
- halaman Shopee search publik masih bisa `Refresh Page State` dan `Sync Now`
- halaman detail produk Shopee publik masih bisa membuka `Kalkulator ROAS`
- `Jenis Toko`, `Promo Extra`, dan `Ongkir Extra` tampil dan bisa diubah tanpa error
- `Biaya Shopee (Total)` dan `Profit Sebelum Iklan` berubah realtime saat input diubah
- picker `Fee Kategori Produk` tetap meminta login jika extension belum login
- auto-saran kategori dari breadcrumb Shopee tetap bekerja bila master fee tersedia
- fallback pilih kategori manual tetap bekerja bila tidak ada match
- deploy server dijalankan manual dengan `FORCE_DEPLOY=1 bash infra/vps/deploy.sh`
- sesudah deploy, operator wajib cek `docker compose -p levelup-adspro -f docker-compose.vps.yml --env-file .env.production ps`
- sesudah deploy, operator wajib cek minimal `https://adspro.naeva.id/` dan `https://adspro.naeva.id/privacy-policy`
- auto deploy berbasis `systemd timer` / polling harus tetap nonaktif
- cek internal monitoring endpoint

## 15. Release Checklist untuk Frontend

- build sukses
- route private dan public berjalan
- environment variables frontend benar
- organization switcher tampil
- sidebar sesuai role
- empty state tidak rusak
- recommendation panel render dengan data kosong dan data ada

## 16. Post-Release Smoke Test

Setelah deploy:

1. buka login
2. login sebagai owner
3. buka dashboard
4. buka shops
5. buka recommendations
6. buka market research
7. cek 1 endpoint internal monitoring
8. cek logs 5-10 menit pertama

## 17. Incident and Rollback Triggers

Rollback atau hotfix perlu dipertimbangkan jika:

- login gagal untuk mayoritas user
- tenant data bocor lintas organization
- ingestion batches gagal massal
- recommendation engine menghasilkan output rusak massal
- dashboard overview crash untuk tenant aktif

## 18. Non-Functional QA Checks

Selain correctness, cek juga:

- response time overview dashboard
- latency recommendation list
- queue backlog
- object storage write success
- migration duration
- memory usage worker

## 19. Observability Checks Before Beta

Minimal sebelum beta:

- request logs tersedia
- worker failure logs tersedia
- ingestion failure count terlihat
- stale extension session count terlihat
- disk growth untuk raw payload terpantau

## 19. QA Ownership

Pembagian sederhana yang disarankan:

- backend engineer: unit dan integration tests domain
- frontend engineer: route, state, dan rendering checks
- product or PM review: acceptance criteria dan UX sanity check
- final release owner: checklist deployment dan smoke test

## 20. Suggested Release Cadence

Untuk fase awal:

- release kecil dan sering
- hindari bundling terlalu banyak domain besar dalam satu release
- migration berat dipisah dari perubahan UI besar jika memungkinkan

## 21. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [18-Dashboard-data-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/18-Dashboard-data-contract-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)
- [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)
- [24-Backend-module-boundaries-and-service-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/24-Backend-module-boundaries-and-service-contract-v1.md)

## 22. Open Questions

- apakah perlu environment staging penuh sejak awal atau cukup dev + limited beta
- apakah E2E browser tests perlu dimulai sebelum dashboard cukup stabil
- apakah recommendation engine perlu golden test dataset khusus
- apakah release notes internal perlu format tetap sejak MVP awal
