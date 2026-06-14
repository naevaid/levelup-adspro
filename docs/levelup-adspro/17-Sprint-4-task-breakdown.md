# LevelUP adsPRO - Sprint 4 Task Breakdown

## 1. Tujuan Sprint

Sprint 4 berfokus pada perubahan dari `raw ingestion` menjadi `usable analytics and recommendations`. Jika Sprint 3 membuat jalur data mulai hidup, maka Sprint 4 membuat data tersebut mulai bernilai untuk user.

Outcome sprint:

- payload mentah mulai dinormalisasi
- aggregate harian pertama tersedia
- overview dashboard dasar bisa membaca data nyata
- recommendation engine v1 mulai menghasilkan output
- profit layer awal mulai terbentuk

## 2. Target Deliverables

- normalization pipeline dasar
- daily aggregate tables
- overview dashboard API
- campaign dan product summary awal
- profit input model dasar
- recommendation engine v1
- in-app recommendation list awal

## 3. Daftar Task

## Epic A - Normalization Pipeline

### Task A1

- Title: Build normalized metrics mapping for owned capture
- Type: Backend
- Priority: `P0`
- Output:
  - mapper untuk payload `owned`
  - normalization untuk campaign metrics dasar
  - normalization untuk product metrics dasar

### Task A2

- Title: Build normalized storage schema for public capture
- Type: Backend
- Priority: `P1`
- Output:
  - penyimpanan session keyword research
  - penyimpanan search result terstruktur
  - pemisahan owned dan public pipeline

### Task A3

- Title: Add normalization job orchestration
- Type: Backend
- Priority: `P0`
- Output:
  - queue job untuk memproses ingestion batch
  - status processing per batch
  - retry untuk batch gagal

### Task A4

- Title: Add normalization error logging and dead-letter handling
- Type: Backend
- Priority: `P1`
- Output:
  - error classification
  - failed batch visibility
  - jalur retry manual dasar

## Epic B - Aggregate and Metrics Layer

### Task B1

- Title: Build daily campaign aggregate table
- Type: Backend
- Priority: `P0`
- Output:
  - table atau materialized aggregate campaign harian
  - key by shop, date, campaign

### Task B2

- Title: Build daily product aggregate table
- Type: Backend
- Priority: `P0`
- Output:
  - aggregate product harian
  - revenue, orders, spend, clicks, impressions

### Task B3

- Title: Build shop overview aggregate
- Type: Backend
- Priority: `P0`
- Output:
  - total revenue
  - total orders
  - total ad spend
  - total profit estimasi

### Task B4

- Title: Implement metrics formula service
- Type: Backend
- Priority: `P0`
- Output:
  - CTR
  - CVR
  - CPC
  - CPM
  - AOV
  - ROAS
  - gross profit
  - net profit
  - break even ROAS

## Epic C - Profit Layer Foundation

### Task C1

- Title: Build product cost input model
- Type: Backend
- Priority: `P0`
- Output:
  - product cost table
  - versioning atau effective date dasar

### Task C2

- Title: Build profit adjustment fields
- Type: Backend
- Priority: `P1`
- Output:
  - marketplace fee
  - admin fee
  - shipping subsidy
  - packaging cost
  - affiliate cost

### Task C3

- Title: Build profit completeness flag logic
- Type: Backend
- Priority: `P0`
- Output:
  - `final`
  - `estimated`
  - `insufficient_data`

## Epic D - Dashboard API

### Task D1

- Title: Build overview dashboard endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - metrics summary per selected date range
  - comparison dengan previous period

### Task D2

- Title: Build top and worst campaign endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - top campaign ranking
  - worst campaign ranking
  - reason metadata

### Task D3

- Title: Build top and worst product endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - top product ranking
  - worst product ranking
  - metric snapshots

### Task D4

- Title: Add data freshness and completeness metadata in API
- Type: Backend
- Priority: `P1`
- Output:
  - `last_synced_at`
  - `data_quality`
  - `sync_source_summary`

## Epic E - Recommendation Engine v1

### Task E1

- Title: Build recommendation rule evaluator
- Type: Backend
- Priority: `P0`
- Output:
  - evaluator untuk scale
  - evaluator untuk pause
  - evaluator untuk improve creative
  - evaluator untuk improve PDP
  - evaluator untuk reduce bid

### Task E2

- Title: Build recommendation storage schema
- Type: Backend
- Priority: `P0`
- Output:
  - recommendation record
  - reason codes
  - severity
  - metrics snapshot

### Task E3

- Title: Build recommendation deduplication logic
- Type: Backend
- Priority: `P1`
- Output:
  - merge recommendation serupa
  - update `last_seen_at`
  - cegah spam rekomendasi identik

### Task E4

- Title: Build recommendation list endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - list recommendation aktif
  - filter by severity
  - filter by entity type

## Epic F - Frontend Dashboard Foundation

### Task F1

- Title: Build overview dashboard page shell
- Type: Frontend
- Priority: `P0`
- Output:
  - summary cards
  - date range selector
  - empty state

### Task F2

- Title: Build campaign insight list
- Type: Frontend
- Priority: `P1`
- Output:
  - top campaign section
  - worst campaign section

### Task F3

- Title: Build recommendation panel
- Type: Frontend
- Priority: `P0`
- Output:
  - recommendation cards
  - severity badge
  - reason summary

### Task F4

- Title: Build data quality badges in UI
- Type: Frontend
- Priority: `P1`
- Output:
  - estimated badge
  - insufficient data badge
  - last sync info

## Epic G - Internal Tools and Observability

### Task G1

- Title: Build internal normalization monitoring page
- Type: Backend
- Priority: `P1`
- Output:
  - processed batches count
  - failed batches count
  - queue lag summary

### Task G2

- Title: Add metric logging for recommendation generation
- Type: Backend
- Priority: `P1`
- Output:
  - recommendations generated per day
  - recommendations by type
  - recommendations by severity

### Task G3

- Title: Add retention metadata to raw payload records
- Type: Backend
- Priority: `P1`
- Output:
  - `retention_until`
  - purge eligibility marker

## 4. Acceptance Criteria Sprint

Sprint 4 dianggap selesai jika:

- payload owned yang valid dapat dinormalisasi
- aggregate harian campaign dan product tersedia
- overview dashboard menampilkan data nyata
- profit estimasi dasar bisa dihitung
- recommendation engine mengeluarkan minimal lima tipe recommendation utama
- user dapat melihat recommendation aktif di dashboard

## 5. Dependency

Sprint ini bergantung pada:

- [10-Extension-capture-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/10-Extension-capture-spec-v1.md)
- [11-Analytics-formula-and-metrics-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/11-Analytics-formula-and-metrics-v1.md)
- [12-Ingestion-payload-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/12-Ingestion-payload-contract-v1.md)
- [14-Sprint-3-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/14-Sprint-3-task-breakdown.md)
- [15-Data-retention-and-storage-policy-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/15-Data-retention-and-storage-policy-v1.md)
- [16-AI-recommendation-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/16-AI-recommendation-spec-v1.md)

## 6. Risiko Sprint 4

- normalisasi awal bisa terlalu generik jika variasi payload marketplace belum cukup dipahami
- profit calculation bisa menyesatkan jika data biaya belum lengkap
- recommendation terlalu bising jika threshold belum dituning
- frontend mudah menampilkan angka yang terlihat final padahal masih estimasi

## 7. Catatan Implementasi

- mulai dari daily aggregate dulu, belum perlu hourly analytics penuh
- prioritaskan Shopee terlebih dahulu untuk validasi end-to-end
- TikTok Shop bisa menyusul setelah mapping owned data stabil
- public market intelligence cukup diproses dasar pada sprint ini, belum perlu insight AI penuh
- recommendation harus memakai `data_quality` badge sejak awal
