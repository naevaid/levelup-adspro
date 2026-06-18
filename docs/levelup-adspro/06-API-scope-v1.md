# LevelUP adsPRO - API Scope v1

## 1. Tujuan

Dokumen ini mendefinisikan ruang lingkup API backend v1 untuk MVP `LevelUP adsPRO`. Fokusnya bukan spesifikasi OpenAPI lengkap, tetapi daftar domain endpoint yang perlu ada agar MVP dapat dibangun secara bertahap.

## 2. Prinsip API

- semua endpoint tenant-bound harus tervalidasi ke `organization`
- API dipisah antara `public auth`, `tenant app`, `extension ingestion`, dan `internal admin`
- v1 fokus pada kebutuhan MVP, bukan cakupan penuh produk
- endpoint write harus memiliki audit trail untuk operasi sensitif

## 3. API Groups

### Public Auth API

- signup
- login
- logout
- forgot password
- reset password
- invite accept

### Tenant App API

- organization
- members
- shops
- subscriptions
- dashboard
- analytics
- profit
- recommendations
- alerts

### Extension API

- extension login
- extension session heartbeat
- payload ingestion
- sync status

### Internal Admin API

- tenant monitoring
- ingestion monitoring
- support lookup

## 4. Public Auth API

### `POST /api/v1/auth/signup`

Tujuan:

- membuat user baru
- membuat organization pertama

### `POST /api/v1/auth/login`

Tujuan:

- login user dan mengembalikan session/token

### `POST /api/v1/auth/logout`

Tujuan:

- mengakhiri session user

### `POST /api/v1/auth/forgot-password`

Tujuan:

- meminta reset password

### `POST /api/v1/auth/reset-password`

Tujuan:

- menyimpan password baru

### `POST /api/v1/invites/accept`

Tujuan:

- menerima undangan organization

## 5. Organization and Member API

### `GET /api/v1/me`

Tujuan:

- mengembalikan profil user aktif dan organization aktif

### `GET /api/v1/organizations/current`

Tujuan:

- membaca detail organization aktif

### `PATCH /api/v1/organizations/current`

Tujuan:

- ubah nama atau setting dasar organization

### `GET /api/v1/organizations/current/members`

Tujuan:

- melihat daftar member

### `POST /api/v1/organizations/current/members/invite`

Tujuan:

- mengundang member baru

### `PATCH /api/v1/organizations/current/members/{memberId}`

Tujuan:

- ubah role member

### `DELETE /api/v1/organizations/current/members/{memberId}`

Tujuan:

- menghapus atau menonaktifkan member

## 6. Subscription API

### `GET /api/v1/plans`

Tujuan:

- menampilkan daftar plan

### `GET /api/v1/subscription`

Tujuan:

- membaca subscription aktif organization

### `POST /api/v1/subscription/change-plan`

Tujuan:

- upgrade atau downgrade plan

### `GET /api/v1/subscription/invoices`

Tujuan:

- menampilkan histori invoice

### `POST /api/v1/subscription/checkout`

Tujuan:

- membuat transaksi awal ke payment gateway

## 7. Shop API

### `GET /api/v1/marketplaces`

Tujuan:

- menampilkan marketplace yang didukung

### `GET /api/v1/shops`

Tujuan:

- melihat daftar shop tenant

### `POST /api/v1/shops`

Tujuan:

- menambah shop baru

### `GET /api/v1/shops/{shopId}`

Tujuan:

- melihat detail shop

### `PATCH /api/v1/shops/{shopId}`

Tujuan:

- ubah metadata shop

Catatan implementasi saat ini:

- dipakai juga untuk menyimpan default ROAS per shop, misalnya:
  - `defaultStoreType`
  - `promoXtraEnabled`
- metadata ini dapat dibaca kembali oleh extension untuk mengisi nilai awal modal `Kalkulator ROAS`

### `GET /api/v1/shops/{shopId}/connection`

Tujuan:

- melihat status connection dan sync health

### `POST /api/v1/shops/{shopId}/sync/manual`

Tujuan:

- memicu sync manual dari sisi dashboard bila perlu

## 8. Extension API

### `POST /api/v1/extension/login`

Tujuan:

- login extension ke akun SaaS

Catatan implementasi saat ini:

- Popup extension menggunakan endpoint session login umum:
  - `POST /api/v1/auth/login`
- Endpoint `extension/login` dapat dipakai jika di masa depan perlu flow login khusus extension, namun saat ini tidak wajib.

### `POST /api/v1/extension/session`

Tujuan:

- membuat atau memperbarui extension session

### `POST /api/v1/extension/heartbeat`

Tujuan:

- mengirim heartbeat extension aktif

### `POST /api/v1/ingestion/batches`

Tujuan:

- membuat batch ingest baru

### `POST /api/v1/ingestion/batches/{batchId}/objects`

Tujuan:

- upload metadata atau payload object untuk batch tertentu

### `GET /api/v1/ingestion/batches/{batchId}`

Tujuan:

- mengecek status proses batch

Catatan:

- implementasi final bisa digabung menjadi satu endpoint ingest
- pemisahan batch dan object disarankan untuk observability

## 9. Dashboard API

### `GET /api/v1/marketplaces`

Tujuan:

- mengambil daftar marketplace untuk keperluan pengaturan dan form

### `GET /api/v1/marketplace-category-fees`

Tujuan:

- mengambil master fee kategori marketplace (tenant-scoped) dari dashboard Settings

### `POST /api/v1/marketplace-category-fees`

Tujuan:

- membuat master fee kategori marketplace

### `PATCH /api/v1/marketplace-category-fees/{id}`

Tujuan:

- mengubah master fee kategori marketplace (aktif/nonaktif, persen, catatan, dll)

### `DELETE /api/v1/marketplace-category-fees/{id}`

Tujuan:

- menghapus master fee kategori marketplace

### `GET /api/v1/dashboard/overview`

Tujuan:

- menampilkan KPI utama

Parameter umum:

- `shop_id`
- `marketplace`
- `date_from`
- `date_to`

### `GET /api/v1/dashboard/freshness`

Tujuan:

- menampilkan status kesegaran data per shop

## 10. Ads Analytics API

### `GET /api/v1/analytics/campaigns`

Tujuan:

- daftar campaign beserta metric utama

### `GET /api/v1/analytics/campaigns/top`

Tujuan:

- top campaign

### `GET /api/v1/analytics/campaigns/worst`

Tujuan:

- worst campaign

### `GET /api/v1/analytics/trends`

Tujuan:

- chart spend, revenue, ROAS, profit

## 11. Product and Shop Analytics API

### `GET /api/v1/analytics/products`

Tujuan:

- ranking product

### `GET /api/v1/analytics/products/top`

Tujuan:

- daftar top product

### `GET /api/v1/analytics/products/worst`

Tujuan:

- daftar worst product

### `GET /api/v1/analytics/shops/compare`

Tujuan:

- perbandingan antar shop

## 12. Profit API

### `GET /api/v1/profit/settings/shops/{shopId}`

Tujuan:

- baca profit settings shop

### `PUT /api/v1/profit/settings/shops/{shopId}`

Tujuan:

- simpan default cost dan fee per shop

### `GET /api/v1/profit/products/{productId}`

Tujuan:

- baca override cost product

### `PUT /api/v1/profit/products/{productId}`

Tujuan:

- simpan override cost product

### `GET /api/v1/profit/snapshots`

Tujuan:

- baca hasil kalkulasi profit

## 13. Recommendation API

### `GET /api/v1/recommendations`

Tujuan:

- daftar rekomendasi aktif

### `GET /api/v1/recommendations/{recommendationId}`

Tujuan:

- detail recommendation dan evidence

### `POST /api/v1/recommendations/{recommendationId}/accept`

Tujuan:

- tandai recommendation diterima

### `POST /api/v1/recommendations/{recommendationId}/ignore`

Tujuan:

- tandai recommendation diabaikan

## 14. Alerts API

### `GET /api/v1/alerts`

Tujuan:

- daftar alert tenant

### `POST /api/v1/alerts/{alertId}/read`

Tujuan:

- tandai alert dibaca

### `POST /api/v1/alerts/read-all`

Tujuan:

- tandai semua alert dibaca

## 15. Internal Admin API

### `GET /api/v1/internal/tenants`

Tujuan:

- melihat daftar tenant untuk support

### `GET /api/v1/internal/ingestion/batches`

Tujuan:

- melihat batch ingestion terbaru

### `GET /api/v1/internal/shops/{shopId}/sync-health`

Tujuan:

- melihat kesehatan sync suatu shop

Catatan:

- internal admin API harus dilindungi role khusus

## 16. API Prioritas Pengerjaan

### Gelombang 1

- auth
- organization current
- plans
- subscription current
- marketplaces
- shops CRUD dasar
- extension login
- ingestion batch

### Gelombang 2

- dashboard overview
- campaigns analytics
- products analytics
- shop comparison
- profit settings
- profit snapshots

### Gelombang 3

- recommendations
- alerts
- invoice history
- internal monitoring

## 17. Open Questions

- apakah extension akan upload langsung ke object storage menggunakan signed URL
- apakah manual sync dari dashboard harus trigger extension atau hanya trigger reprocessing backend
- apakah recommendation accept/ignore wajib ada di MVP beta pertama
- apakah invoicing perlu PDF sejak v1 atau cukup record database dan tampilan web
