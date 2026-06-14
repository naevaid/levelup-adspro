# LevelUP adsPRO - ERD v1

## 1. Tujuan

Dokumen ini menyusun ERD v1 untuk MVP `LevelUP adsPRO`. Fokusnya adalah entitas minimum yang dibutuhkan agar:

- SaaS multi-tenant bisa berjalan
- shop bisa terhubung
- extension bisa mengirim data
- analytics dan profit bisa dihitung
- recommendation dan alert bisa dibuat

## 2. Prinsip ERD

- semua data tenant-bound wajib membawa `organization_id`
- subscription melekat ke `organization`
- raw payload disimpan terpisah dari tabel analytics
- metrics agregat dipisahkan dari entitas master
- recommendation dan alert tidak menghitung ulang semua angka, tetapi membaca hasil analytics dan profit

## 3. Entity Groups

### Tenant and Identity

- `users`
- `organizations`
- `organization_members`

### Subscription

- `plans`
- `subscriptions`
- `subscription_invoices`

### Marketplace and Shops

- `marketplaces`
- `shops`
- `marketplace_connections`

### Extension and Ingestion

- `extension_sessions`
- `ingestion_batches`
- `raw_payload_objects`

### Ads and Catalog

- `products`
- `campaigns`
- `ad_groups`

### Analytics and Profit

- `daily_metrics`
- `hourly_metrics`
- `shop_profit_settings`
- `product_profit_overrides`
- `profit_snapshots`

### Decision and Monitoring

- `recommendations`
- `alerts`
- `audit_logs`

## 4. ERD Ringkas

```text
users
  1 --- * organization_members * --- 1 organizations

organizations
  1 --- * subscriptions * --- 1 plans
  1 --- * subscription_invoices
  1 --- * shops
  1 --- * extension_sessions
  1 --- * ingestion_batches
  1 --- * products
  1 --- * campaigns
  1 --- * ad_groups
  1 --- * daily_metrics
  1 --- * hourly_metrics
  1 --- * shop_profit_settings
  1 --- * product_profit_overrides
  1 --- * profit_snapshots
  1 --- * recommendations
  1 --- * alerts
  1 --- * audit_logs

marketplaces
  1 --- * shops
  1 --- * daily_metrics
  1 --- * hourly_metrics

shops
  1 --- * marketplace_connections
  1 --- * ingestion_batches
  1 --- * raw_payload_objects
  1 --- * products
  1 --- * campaigns
  1 --- * ad_groups
  1 --- * daily_metrics
  1 --- * hourly_metrics
  1 --- * shop_profit_settings
  1 --- * product_profit_overrides
  1 --- * profit_snapshots
  1 --- * recommendations
  1 --- * alerts

ingestion_batches
  1 --- * raw_payload_objects

campaigns
  1 --- * ad_groups

products
  1 --- * product_profit_overrides
```

## 5. Relasi Inti

### `users` -> `organization_members` -> `organizations`

- satu user bisa menjadi anggota banyak organization
- satu organization bisa punya banyak user
- role disimpan di `organization_members`

### `organizations` -> `subscriptions`

- satu organization memiliki subscription aktif
- histori perubahan plan tetap bisa disimpan bila nanti diperlukan

### `organizations` -> `shops`

- satu organization bisa punya banyak shop
- shop menjadi unit utama untuk analytics dan ingestion

### `shops` -> `marketplace_connections`

- satu shop bisa punya satu atau lebih koneksi teknis
- tabel ini menyimpan status sync dan metadata integrasi

### `shops` -> `ingestion_batches` -> `raw_payload_objects`

- setiap sync menghasilkan satu `ingestion_batch`
- satu batch dapat berisi banyak object mentah
- object mentah disimpan di object storage, referensinya disimpan di database

### `shops` -> `products`, `campaigns`, `ad_groups`

- entitas master hasil normalisasi marketplace
- digunakan ulang oleh analytics engine

### `shops` -> `daily_metrics`, `hourly_metrics`

- menyimpan metrik agregat untuk dashboard

### `shops` -> `shop_profit_settings`

- menyimpan biaya default per shop

### `products` -> `product_profit_overrides`

- menyimpan override COGS atau biaya spesifik per product

### `shops` -> `profit_snapshots`

- hasil kalkulasi profit teragregasi untuk object tertentu

### `shops` -> `recommendations`

- hasil rule engine dan AI explanation

### `shops` -> `alerts`

- hasil trigger monitoring yang perlu dilihat user

## 6. Tabel Minimum untuk Sprint Awal

Tabel yang harus dibuat lebih dulu:

- `users`
- `organizations`
- `organization_members`
- `plans`
- `subscriptions`
- `marketplaces`
- `shops`
- `marketplace_connections`
- `extension_sessions`
- `ingestion_batches`
- `raw_payload_objects`

Tabel yang bisa menyusul setelah ingestion stabil:

- `products`
- `campaigns`
- `ad_groups`
- `daily_metrics`
- `hourly_metrics`
- `shop_profit_settings`
- `product_profit_overrides`
- `profit_snapshots`
- `recommendations`
- `alerts`
- `audit_logs`

## 7. Catatan Desain

- `hourly_metrics` boleh ditunda jika beban MVP perlu diperkecil
- `ai_conversations` belum masuk ERD v1 karena AI chat belum prioritas
- `competitor_tracking` juga belum masuk karena bukan bagian MVP
- semua tabel analitik sebaiknya diindeks minimal pada:
  - `organization_id`
  - `shop_id`
  - `metric_date` atau `metric_hour`

## 8. Open Questions

- apakah `campaigns` dan `products` perlu versioning sejak awal
- apakah `raw_payload_objects` perlu menyimpan partial parsed summary
- apakah `subscriptions` perlu menyimpan histori change log langsung di tabel yang sama atau tabel terpisah
- apakah `shop_profit_settings` cukup satu versi aktif atau perlu histori penuh sejak MVP
