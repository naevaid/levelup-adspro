# LevelUP adsPRO - Architecture and Data Model Draft

## 1. Tujuan Dokumen

Dokumen ini menjabarkan arsitektur awal yang realistis untuk membangun `LevelUP adsPRO` di lingkungan VPS Ubuntu, dengan target MVP yang cepat dikembangkan, hemat biaya, dan mudah dipelihara.

## 2. Prinsip Arsitektur

Untuk MVP, sistem direkomendasikan memakai `modular monolith` dan bukan microservices penuh.

Alasan:

- tim bisa bergerak lebih cepat
- deployment lebih sederhana
- lebih mudah ditest dan di-debug
- biaya operasional awal lebih rendah
- pemisahan domain bisnis tetap bisa dilakukan lewat modul internal

Catatan tambahan:

- sistem harus mendukung dua jalur data: `connected shop` dan `public market intelligence`
- kedua jalur ini boleh memakai extension yang sama, tetapi pipeline dan storage logic harus dibedakan

## 3. Logical Architecture

```text
+-----------------------+
| Chrome Extension      |
+-----------------------+
           |
           v
+-----------------------+
| API / Ingestion Layer |
+-----------------------+
           |
           v
+-----------------------+
| Queue / Worker Layer  |
+-----------------------+
           |
  +--------+--------+------------------+
  |                 |                  |
  v                 v                  v
+------------+ +------------+ +---------------+
| Analytics  | | Profit     | | Recommendation|
| Engine     | | Engine     | | Engine        |
+------------+ +------------+ +---------------+
       \            |               /
        \           |              /
         +----------+-------------+
                    |
                    v
             +--------------+
             | PostgreSQL   |
             +--------------+
                    |
                    v
             +--------------+
             | Dashboard UI |
             +--------------+
```

### Extended Logical View

```text
+------------------------+       +---------------------------+
| Connected Shop Capture |       | Public Market Research    |
| via Seller Dashboard   |       | via Public Search / List  |
+------------------------+       +---------------------------+
             \                           /
              \                         /
               v                       v
                +---------------------+
                | Chrome Extension    |
                +---------------------+
                           |
                           v
                +---------------------+
                | API / Ingestion     |
                +---------------------+
                      |           |
                      v           v
             +----------------+  +----------------------+
             | Owned Data     |  | Market Intelligence  |
             | Pipeline       |  | Pipeline             |
             +----------------+  +----------------------+
                      |           |
                      +-----+-----+
                            |
                            v
                     +--------------+
                     | PostgreSQL   |
                     +--------------+
```

## 4. Physical Architecture MVP

Komponen yang disarankan untuk 1 environment awal:

- `frontend`: Next.js
- `api`: NestJS app
- `worker`: NestJS worker atau process terpisah berbasis BullMQ
- `postgres`: primary relational database
- `redis`: queue, cache, lock
- `minio`: raw snapshot storage
- `reverse proxy`: Traefik atau Nginx
- `monitoring`: Grafana + metrics/log collector dasar

Untuk tahap awal, semua bisa dijalankan di satu VPS dengan Docker Compose.

## 5. Deployment Topology Awal

### App Containers

- `levelup-web`
- `levelup-api`
- `levelup-worker`
- `levelup-postgres`
- `levelup-redis`
- `levelup-minio`
- `levelup-grafana`

### Domain Suggestion

- `app.levelup-domain.com` -> frontend
- `api.levelup-domain.com` -> API
- `ingest.levelup-domain.com` -> opsional, bisa tetap lewat API
- `assets.levelup-domain.com` -> opsional untuk static asset

## 6. Backend Module Boundaries

Disarankan memakai struktur modul seperti ini:

- `auth`
- `organizations`
- `memberships`
- `subscriptions`
- `shops`
- `marketplace-connections`
- `extension-sessions`
- `ingestion`
- `raw-data`
- `analytics`
- `profit`
- `recommendations`
- `alerts`
- `billing`
- `audit-logs`
- `market-research`
- `keyword-intelligence`

Jika nanti scale meningkat, modul yang paling mungkin dipisah lebih dulu:

- ingestion
- analytics worker
- billing
- AI services
- public market intelligence ingestion

## 7. Capture Modes

### 7.1 Connected Shop Capture

Dipakai untuk:

- dashboard seller
- dashboard ads
- halaman internal toko sendiri

Data yang diharapkan:

- campaign
- ad performance
- product performance
- spend
- revenue
- orders

### 7.2 Public Market Intelligence Capture

Dipakai untuk:

- halaman pencarian marketplace publik
- halaman listing produk publik
- hasil keyword search

Data yang diharapkan:

- keyword
- posisi hasil pencarian bila tersedia
- nama produk
- range harga
- data penjualan yang terlihat
- seller atau shop publik bila tersedia
- timestamp capture

Prinsip:

- mode ini tidak wajib connect shop
- user cukup login ke sistem bila ingin menyimpan hasil riset
- parser dan schema untuk mode ini sebaiknya dipisahkan dari owned-data parser

## 8. Data Processing Layers

### Layer 1 - Raw Capture

Data mentah yang datang dari extension disimpan apa adanya untuk:

- audit
- replay
- debugging parser
- schema evolution
- pemisahan sumber capture `owned` vs `public`

### Layer 2 - Normalized Data

Payload mentah dinormalisasi menjadi bentuk seragam lintas marketplace, misalnya:

- campaign
- ad group
- product
- metric snapshot
- keyword research result
- public product observation

### Layer 3 - Aggregated Metrics

Menyimpan metrik yang siap ditampilkan dashboard:

- daily metrics
- hourly metrics
- campaign metrics
- product metrics
- shop metrics

### Layer 4 - Business Metrics

Metrik bisnis hasil kalkulasi:

- break even ROAS
- net profit
- net margin
- efficiency score

### Layer 5 - AI Insights

Berisi diagnosis, rekomendasi, alert, dan explanation.

## 9. Database Strategy

Database utama: PostgreSQL

Alasan:

- relational integrity kuat
- cocok untuk multi-tenant SaaS
- fleksibel untuk analytics operasional
- tetap aman dipakai sampai volume menengah

### Strategi Umum

- tabel transactional terpisah dari tabel agregat
- raw payload besar jangan memenuhi tabel hot-path
- gunakan indeks berdasarkan `organization_id`, `shop_id`, `date`
- gunakan partisi bila volume daily metrics membesar

## 10. Storage Strategy

### PostgreSQL

Untuk:

- identity
- tenant
- subscription
- normalized entities
- metrics agregat
- recommendation
- alert

### MinIO / Object Storage

Untuk:

- raw JSON snapshots
- export file
- ingestion archive
- AI report attachment jika nanti ada

## 11. Core Tables Draft

## 11.1 Identity and Tenant

### `users`

- id
- email
- password_hash
- full_name
- status
- last_login_at
- created_at
- updated_at

### `organizations`

- id
- name
- slug
- owner_user_id
- country_code
- timezone
- status
- created_at
- updated_at

### `organization_members`

- id
- organization_id
- user_id
- role
- invited_by
- joined_at
- status

## 11.2 Subscription

### `plans`

- id
- code
- name
- max_shops
- max_users
- retention_days
- ai_enabled
- white_label_enabled
- api_access_enabled
- price_monthly
- price_yearly

### `subscriptions`

- id
- organization_id
- plan_id
- status
- billing_cycle
- started_at
- ends_at
- auto_renew
- provider
- provider_reference

### `subscription_invoices`

- id
- subscription_id
- invoice_no
- amount
- tax_amount
- currency
- status
- issued_at
- paid_at

## 11.3 Shop and Marketplace

### `marketplaces`

- id
- code
- name

### `shops`

- id
- organization_id
- marketplace_id
- shop_name
- external_shop_id
- external_shop_code
- currency
- timezone
- status
- created_at
- updated_at

### `marketplace_connections`

- id
- shop_id
- connection_type
- status
- last_sync_at
- last_success_sync_at
- last_failed_sync_at
- failure_count
- metadata_json

## 11.4 Extension and Ingestion

### `extension_sessions`

- id
- organization_id
- user_id
- device_id
- extension_version
- browser_name
- last_heartbeat_at
- status

### `ingestion_batches`

- id
- organization_id
- shop_id
- source
- payload_schema_version
- sync_type
- idempotency_key
- status
- received_at
- processed_at
- error_message
- capture_mode

### `raw_payload_objects`

- id
- ingestion_batch_id
- organization_id
- shop_id
- object_type
- object_date
- storage_key
- payload_hash
- size_bytes
- created_at
- visibility_scope
- source_page_type

### `keyword_research_sessions`

- id
- organization_id
- user_id
- marketplace_id
- keyword
- source
- status
- captured_at
- saved_at

### `keyword_research_results`

- id
- session_id
- organization_id
- marketplace_id
- product_title
- shop_name
- listed_price_min
- listed_price_max
- sales_hint
- ranking_position
- product_url
- captured_at

## 11.5 Catalog and Ads Domain

### `products`

- id
- organization_id
- shop_id
- marketplace_product_id
- marketplace_sku
- seller_sku
- product_name
- status

### `campaigns`

- id
- organization_id
- shop_id
- marketplace_campaign_id
- campaign_name
- campaign_type
- status
- budget_amount
- started_at
- ended_at

### `ad_groups`

- id
- organization_id
- shop_id
- campaign_id
- marketplace_ad_group_id
- name
- status

## 11.6 Metrics

### `daily_metrics`

- id
- organization_id
- shop_id
- marketplace_id
- metric_scope
- metric_date
- object_type
- object_id
- impressions
- clicks
- ctr
- orders
- units_sold
- revenue
- ad_spend
- roas
- cvr
- aov

### `hourly_metrics`

- id
- organization_id
- shop_id
- marketplace_id
- metric_hour
- object_type
- object_id
- impressions
- clicks
- orders
- revenue
- ad_spend

## 11.7 Profit

### `shop_profit_settings`

- id
- organization_id
- shop_id
- default_cogs_mode
- marketplace_fee_mode
- packaging_cost
- shipping_subsidy
- admin_fee
- affiliate_cost
- effective_from

### `product_profit_overrides`

- id
- organization_id
- shop_id
- product_id
- cogs
- packaging_cost
- effective_from

### `profit_snapshots`

- id
- organization_id
- shop_id
- metric_date
- object_type
- object_id
- revenue
- ad_spend
- gross_profit
- net_profit
- profit_margin
- break_even_roas
- is_estimated

## 11.8 Recommendation and AI

### `recommendations`

- id
- organization_id
- shop_id
- object_type
- object_id
- recommendation_type
- severity
- confidence_score
- rule_version
- evidence_json
- ai_summary
- status
- created_at

### `ai_conversations`

- id
- organization_id
- user_id
- title
- created_at

### `ai_messages`

- id
- conversation_id
- role
- prompt_text
- response_text
- evidence_json
- token_usage
- created_at

Catatan:

- `ai_conversations` dan `ai_messages` bukan prioritas MVP bila AI chat belum diaktifkan
- tabel ini boleh ditunda implementasinya

## 11.9 Alerts and Audit

### `alerts`

- id
- organization_id
- shop_id
- alert_type
- severity
- title
- body
- channel
- status
- triggered_at

### `audit_logs`

- id
- organization_id
- user_id
- action
- target_type
- target_id
- request_id
- metadata_json
- created_at

## 12. Multi-Tenant Isolation Rules

Semua tabel tenant-bound wajib membawa `organization_id`.

Aturan:

- query default harus scoped ke `organization_id`
- background job harus memvalidasi tenant sebelum memproses data
- storage object key harus mengandung tenant identifier
- audit logs harus bisa menunjukkan actor dan tenant

Untuk market research:

- hasil riset yang disimpan harus tetap scoped ke `organization_id`
- data publik yang belum disimpan user tidak wajib menjadi permanent record tenant

## 13. Analytics Engine Design

### Input

- raw payload dari extension
- master shop
- profit settings
- keyword research captures

### Process

- validate
- normalize
- dedupe
- aggregate
- recalculate derived metrics

### Output

- daily metrics
- hourly metrics
- product analytics
- campaign analytics
- shop analytics
- market research observations

## 14. Recommendation Engine Design

Engine ini idealnya deterministic pada MVP.

Contoh pipeline:

1. ambil daily metrics dan profit snapshot terbaru
2. evaluasi rules
3. simpan recommendation record
4. generate AI summary dari evidence yang sudah ada
5. kirim alert bila severity tinggi

## 15. Alert Engine Design

Jenis trigger:

- threshold based
- trend based
- anomaly placeholder

Prioritas MVP:

- negative profit
- ROAS drop
- abnormal spend
- winning campaign

## 16. Queue and Worker Design

Job utama yang disarankan:

- `ingestion.normalize`
- `ingestion.aggregate`
- `profit.recalculate`
- `recommendation.generate`
- `alert.dispatch`
- `market-research.normalize`
- `market-research.aggregate`

Prinsip:

- idempotent
- retryable
- observable
- dead-letter ready bila volume membesar

## 17. Security and Compliance Notes

- JWT untuk web session API
- token khusus untuk extension
- encrypt sensitive config
- minimalkan penyimpanan data session marketplace
- audit semua perubahan role, billing, dan profit settings
- rate limit untuk ingestion endpoint
- batasi penyimpanan data publik yang tidak benar-benar diperlukan
- bedakan token dan permission untuk capture toko sendiri vs riset publik

## 18. Observability

Minimal observability pada MVP:

- request logs API
- queue job success/failure
- ingestion error dashboard
- sync success rate per marketplace
- DB health dan disk usage
- capture success rate untuk keyword research
- parser failure rate untuk public search result

## 19. Backup and Retention

### Backup

- backup PostgreSQL harian
- backup object storage terjadwal
- retention backup minimal 7-14 hari untuk tahap awal

### Retention

- raw data retention sesuai plan
- aggregated metrics bisa disimpan lebih lama
- AI conversation retention bisa dibatasi untuk efisiensi
- market research snapshots dapat memiliki retention terpisah untuk efisiensi storage

## 20. Suggested Phased Scaling

### Tahap Awal

- 1 VPS
- Docker Compose
- PostgreSQL single instance
- Redis single instance

### Saat Growth Validated

- pisahkan worker dari API
- pisahkan PostgreSQL ke managed atau node khusus
- aktifkan read replica bila perlu
- pertimbangkan partisi metrics table

### Saat Scale Besar

- pecah ingestion service
- pecah AI service
- tambah metrics warehouse jika query analitik semakin berat
- pertimbangkan service khusus untuk market intelligence ingestion bila volume keyword capture membesar

## 21. Open Technical Questions

- apakah raw payload perlu disimpan penuh untuk semua sinkronisasi atau hanya delta tertentu
- apakah hourly metrics benar-benar wajib di MVP atau cukup daily dulu
- apakah AI summary disimpan permanen atau dihitung on demand
- apakah competitor domain nanti perlu schema terpisah sejak awal
- bagaimana versi schema capture extension dikelola saat marketplace berubah cepat
- apakah keyword research result perlu TTL default
- apakah ranking hasil pencarian cukup disimpan saat capture atau perlu rekalkulasi historis
