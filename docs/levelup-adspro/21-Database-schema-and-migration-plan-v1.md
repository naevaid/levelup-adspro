# LevelUP adsPRO - Database Schema and Migration Plan v1

## 1. Tujuan

Dokumen ini mendefinisikan rencana awal schema database dan urutan migration untuk `LevelUP adsPRO` agar implementasi backend dapat berjalan bertahap tanpa kehilangan arah arsitektural.

Fokus v1:

- relational schema inti untuk MVP
- urutan migration yang realistis
- aturan indexing dasar
- batas antara tabel operasional, analytics, dan audit

## 2. Prinsip Desain Schema

- semua data tenant-bound wajib membawa `organization_id`
- schema harus mendukung `modular monolith`, bukan microservices
- raw payload besar tidak boleh menjadi pusat query utama dashboard
- tabel aggregate harus dipisah dari entitas master
- data sensitif dan audit harus punya lifecycle yang jelas
- migration harus bisa dibangun bertahap per sprint

## 3. Engine dan Konvensi

### Database Utama

- PostgreSQL

### Konvensi Umum

- primary key default: `id`
- foreign key eksplisit
- timestamps standar:
  - `created_at`
  - `updated_at`
- soft delete hanya untuk tabel tertentu yang memang butuh restore
- nama tabel plural snake_case

### Tipe ID

Pilihan yang realistis:

- `bigint` auto increment untuk MVP awal, atau
- `uuid` bila ingin lebih aman untuk distribusi data sejak awal

Rekomendasi awal:

- gunakan `bigint` untuk implementasi cepat
- simpan opsi migrasi ke `uuid` untuk versi berikutnya jika benar-benar diperlukan

## 4. Kelompok Tabel

### 4.1 Identity and Tenant

- `users`
- `organizations`
- `memberships`
- `organization_invites`
- `user_sessions`

### 4.2 Subscription and Billing

- `plans`
- `subscriptions`
- `subscription_invoices`
- `subscription_events`

### 4.3 Marketplace and Shops

- `marketplaces`
- `shops`
- `marketplace_connections`

### 4.4 Extension and Ingestion

- `extension_sessions`
- `ingestion_batches`
- `raw_payload_objects`

### 4.5 Master Data

- `products`
- `campaigns`
- `ad_groups`

### 4.6 Analytics and Profit

- `daily_campaign_metrics`
- `daily_product_metrics`
- `daily_shop_metrics`
- `keyword_research_sessions`
- `keyword_research_results`
- `shop_profit_settings`
- `product_profit_overrides`
- `profit_snapshots`

### 4.7 Recommendations and Monitoring

- `recommendations`
- `recommendation_feedback`
- `alerts`
- `audit_logs`

## 5. Tabel Inti dan Field Minimum

## 5.1 `users`

Field minimum:

- `id`
- `email`
- `password_hash`
- `name`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

Index minimum:

- unique `email`

## 5.2 `organizations`

Field minimum:

- `id`
- `name`
- `slug`
- `owner_user_id`
- `status`
- `created_at`
- `updated_at`

Index minimum:

- unique `slug`
- index `owner_user_id`

## 5.3 `memberships`

Field minimum:

- `id`
- `organization_id`
- `user_id`
- `role`
- `status`
- `invited_by_user_id`
- `joined_at`
- `created_at`
- `updated_at`

Constraint minimum:

- unique (`organization_id`, `user_id`)

Index minimum:

- index `organization_id`
- index `user_id`
- index (`organization_id`, `role`)

## 5.4 `organization_invites`

Field minimum:

- `id`
- `organization_id`
- `email`
- `role`
- `token`
- `status`
- `expires_at`
- `invited_by_user_id`
- `accepted_at`
- `created_at`
- `updated_at`

Index minimum:

- unique `token`
- index `organization_id`
- index `email`

## 5.5 `user_sessions`

Field minimum:

- `id`
- `user_id`
- `active_organization_id`
- `session_token_hash`
- `expires_at`
- `last_seen_at`
- `created_at`
- `updated_at`

Index minimum:

- unique `session_token_hash`
- index `user_id`
- index `active_organization_id`

## 5.6 `plans`

Field minimum:

- `id`
- `code`
- `name`
- `billing_interval`
- `shop_limit`
- `member_limit`
- `history_days`
- `features_json`
- `status`
- `created_at`
- `updated_at`

Constraint minimum:

- unique `code`

## 5.7 `subscriptions`

Field minimum:

- `id`
- `organization_id`
- `plan_id`
- `status`
- `starts_at`
- `ends_at`
- `auto_renew`
- `provider`
- `provider_reference`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `plan_id`
- index (`organization_id`, `status`)

## 5.8 `subscription_invoices`

Field minimum:

- `id`
- `organization_id`
- `subscription_id`
- `invoice_number`
- `amount`
- `currency`
- `status`
- `issued_at`
- `paid_at`
- `created_at`
- `updated_at`

Index minimum:

- unique `invoice_number`
- index `organization_id`
- index `subscription_id`

## 5.9 `subscription_events`

Field minimum:

- `id`
- `organization_id`
- `subscription_id`
- `event_type`
- `payload_json`
- `occurred_at`
- `created_at`

Index minimum:

- index `organization_id`
- index `subscription_id`
- index `event_type`

## 5.10 `marketplaces`

Field minimum:

- `id`
- `code`
- `name`
- `status`
- `created_at`
- `updated_at`

Constraint minimum:

- unique `code`

## 5.11 `shops`

Field minimum:

- `id`
- `organization_id`
- `marketplace_id`
- `name`
- `external_shop_id`
- `status`
- `timezone`
- `currency`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `marketplace_id`
- index (`organization_id`, `status`)

## 5.12 `marketplace_connections`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `connection_type`
- `status`
- `last_synced_at`
- `last_error_code`
- `last_error_message`
- `meta_json`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index (`shop_id`, `status`)

## 5.13 `extension_sessions`

Field minimum:

- `id`
- `organization_id`
- `user_id`
- `shop_id`
- `device_label`
- `extension_version`
- `session_token_hash`
- `status`
- `last_heartbeat_at`
- `expires_at`
- `created_at`
- `updated_at`

Index minimum:

- unique `session_token_hash`
- index `organization_id`
- index `user_id`
- index `shop_id`

## 5.14 `ingestion_batches`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `extension_session_id`
- `capture_mode`
- `page_type`
- `marketplace`
- `payload_schema_version`
- `status`
- `captured_at`
- `processed_at`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index `extension_session_id`
- index (`organization_id`, `status`)
- index (`shop_id`, `captured_at`)

## 5.15 `raw_payload_objects`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `ingestion_batch_id`
- `storage_key`
- `payload_hash`
- `size_bytes`
- `retention_until`
- `status`
- `created_at`
- `updated_at`

Constraint minimum:

- unique (`ingestion_batch_id`, `payload_hash`)

Index minimum:

- index `organization_id`
- index `shop_id`
- index `ingestion_batch_id`
- index `retention_until`

## 5.16 `products`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `marketplace`
- `external_product_id`
- `name`
- `sku`
- `status`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index (`shop_id`, `sku`)
- index (`shop_id`, `external_product_id`)

## 5.17 `campaigns`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `marketplace`
- `external_campaign_id`
- `name`
- `campaign_type`
- `status`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index (`shop_id`, `external_campaign_id`)

## 5.18 `ad_groups`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `campaign_id`
- `external_ad_group_id`
- `name`
- `status`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index `campaign_id`

## 5.19 `daily_campaign_metrics`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `campaign_id`
- `metric_date`
- `impressions`
- `clicks`
- `orders`
- `units_sold`
- `revenue`
- `ad_spend`
- `roas`
- `net_profit`
- `data_quality`
- `created_at`
- `updated_at`

Constraint minimum:

- unique (`shop_id`, `campaign_id`, `metric_date`)

Index minimum:

- index `organization_id`
- index `shop_id`
- index `campaign_id`
- index `metric_date`

## 5.20 `daily_product_metrics`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `product_id`
- `metric_date`
- `impressions`
- `clicks`
- `orders`
- `units_sold`
- `revenue`
- `ad_spend`
- `roas`
- `net_profit`
- `data_quality`
- `created_at`
- `updated_at`

Constraint minimum:

- unique (`shop_id`, `product_id`, `metric_date`)

## 5.21 `daily_shop_metrics`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `metric_date`
- `revenue`
- `orders`
- `ad_spend`
- `gross_profit`
- `net_profit`
- `data_quality`
- `created_at`
- `updated_at`

Constraint minimum:

- unique (`shop_id`, `metric_date`)

## 5.22 `keyword_research_sessions`

Field minimum:

- `id`
- `organization_id`
- `user_id`
- `marketplace`
- `keyword`
- `source`
- `status`
- `captured_at`
- `saved_at`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `user_id`
- index (`organization_id`, `captured_at`)

## 5.23 `keyword_research_results`

Field minimum:

- `id`
- `session_id`
- `organization_id`
- `marketplace`
- `product_title`
- `shop_name`
- `listed_price_min`
- `listed_price_max`
- `sales_hint`
- `ranking_position`
- `product_url`
- `captured_at`
- `created_at`
- `updated_at`

Index minimum:

- index `session_id`
- index `organization_id`
- index (`session_id`, `ranking_position`)

## 5.24 `shop_profit_settings`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `marketplace_fee_default`
- `admin_fee_default`
- `shipping_subsidy_default`
- `packaging_cost_default`
- `affiliate_cost_default`
- `effective_from`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`

## 5.25 `product_profit_overrides`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `product_id`
- `cogs_per_unit`
- `effective_from`
- `created_at`
- `updated_at`

Constraint minimum:

- unique (`product_id`, `effective_from`)

## 5.26 `profit_snapshots`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `entity_type`
- `entity_id`
- `period_start`
- `period_end`
- `gross_profit`
- `net_profit`
- `profit_margin`
- `break_even_roas`
- `data_quality`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index (`entity_type`, `entity_id`)

## 5.27 `recommendations`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `entity_type`
- `entity_id`
- `recommendation_type`
- `severity`
- `title`
- `summary`
- `reason_codes_json`
- `metrics_snapshot_json`
- `data_quality`
- `status`
- `generated_at`
- `last_seen_at`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index (`shop_id`, `status`)
- index (`entity_type`, `entity_id`)
- index `recommendation_type`

## 5.28 `recommendation_feedback`

Field minimum:

- `id`
- `organization_id`
- `recommendation_id`
- `user_id`
- `feedback_type`
- `reason`
- `created_at`

Index minimum:

- index `organization_id`
- index `recommendation_id`
- index `user_id`

## 5.29 `alerts`

Field minimum:

- `id`
- `organization_id`
- `shop_id`
- `alert_type`
- `severity`
- `title`
- `message`
- `status`
- `read_at`
- `created_at`
- `updated_at`

Index minimum:

- index `organization_id`
- index `shop_id`
- index (`organization_id`, `status`)

## 5.30 `audit_logs`

Field minimum:

- `id`
- `organization_id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `before_data_json`
- `after_data_json`
- `created_at`

Index minimum:

- index `organization_id`
- index `actor_user_id`
- index `action`
- index `created_at`

## 6. Foreign Key Rules

Aturan awal yang disarankan:

- semua tabel child wajib punya foreign key ke parent utama
- foreign key berat pada tabel analytics bisa dibuat selektif jika performa migration menjadi masalah
- minimal gunakan foreign key keras untuk:
  - `memberships`
  - `shops`
  - `marketplace_connections`
  - `extension_sessions`
  - `ingestion_batches`
  - `raw_payload_objects`
  - `recommendation_feedback`

## 7. Indexing Strategy Awal

Index yang wajib diprioritaskan:

- semua kolom foreign key
- semua kolom pencarian tenant:
  - `organization_id`
  - `shop_id`
- semua kolom tanggal utama:
  - `metric_date`
  - `captured_at`
  - `generated_at`
- semua kolom unique business key:
  - `email`
  - `slug`
  - `invoice_number`

## 8. Partitioning dan Scale Notes

Untuk MVP awal, cukup gunakan tabel normal tanpa partisi penuh.

Kandidat partisi di fase berikutnya:

- `daily_campaign_metrics`
- `daily_product_metrics`
- `daily_shop_metrics`
- `audit_logs`
- `ingestion_batches`

Partisi awal paling masuk akal jika volume sudah naik:

- by month pada `metric_date` atau `created_at`

## 9. Migration Plan by Wave

### Wave 1 - Identity and Tenant

Urutan:

1. `users`
2. `organizations`
3. `memberships`
4. `organization_invites`
5. `user_sessions`

### Wave 2 - Subscription and Shops

Urutan:

1. `plans`
2. `subscriptions`
3. `subscription_invoices`
4. `subscription_events`
5. `marketplaces`
6. `shops`
7. `marketplace_connections`

### Wave 3 - Extension and Ingestion

Urutan:

1. `extension_sessions`
2. `ingestion_batches`
3. `raw_payload_objects`

### Wave 4 - Master Data

Urutan:

1. `products`
2. `campaigns`
3. `ad_groups`

### Wave 5 - Analytics and Profit

Urutan:

1. `daily_campaign_metrics`
2. `daily_product_metrics`
3. `daily_shop_metrics`
4. `keyword_research_sessions`
5. `keyword_research_results`
6. `shop_profit_settings`
7. `product_profit_overrides`
8. `profit_snapshots`

### Wave 6 - Recommendation and Monitoring

Urutan:

1. `recommendations`
2. `recommendation_feedback`
3. `alerts`
4. `audit_logs`

## 10. Sprint Mapping

- Sprint 1:
  - `users`
  - `organizations`
  - `memberships`
  - `plans`
  - `subscriptions`
- Sprint 2:
  - `marketplaces`
  - `shops`
  - `marketplace_connections`
- Sprint 3:
  - `extension_sessions`
  - `ingestion_batches`
  - `raw_payload_objects`
- Sprint 4:
  - `products`
  - `campaigns`
  - `ad_groups`
  - `daily_*_metrics`
  - `shop_profit_settings`
  - `product_profit_overrides`
  - `profit_snapshots`
  - `recommendations`
- Sprint 5:
  - `organization_invites`
  - `user_sessions`
  - `recommendation_feedback`
  - `alerts`
  - `audit_logs`
- Sprint 6:
  - schema hardening
  - index refinement
  - retention fields
  - optional partition preparation

## 11. Data Integrity Notes

- `organization_id` pada child table harus konsisten dengan parent resource
- insert analytics wajib menolak entity lintas tenant
- enum-like field seperti `role`, `status`, `severity`, `recommendation_type` harus dibatasi melalui validation layer
- `metrics_snapshot_json` dan `reason_codes_json` tetap perlu schema discipline walau berbentuk JSON

## 12. Migration Safety Rules

- migration harus additive sebisa mungkin
- hindari rename kolom tanpa fallback plan
- index berat dibuat di fase terpisah jika data sudah besar
- backfill data harus dipisahkan dari migration schema jika prosesnya panjang

## 13. Seed Data Awal

Seed minimum:

- plans:
  - `free`
  - `starter`
  - `pro`
  - `agency`
- marketplaces:
  - `shopee`
  - `tiktok_shop`

## 14. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)
- [05-ERD-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/05-ERD-v1.md)
- [15-Data-retention-and-storage-policy-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/15-Data-retention-and-storage-policy-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)

## 15. Open Questions

- apakah `bigint` cukup untuk fase awal atau lebih aman langsung `uuid`
- apakah `daily_*_metrics` perlu dipisahkan lagi per marketplace sejak awal
- apakah `audit_logs` perlu dipindah ke storage terpisah jika volume cepat membesar
- apakah `profit_snapshots` cukup satu tabel generik atau perlu dipisah per entity type
