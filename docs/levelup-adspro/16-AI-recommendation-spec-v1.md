# LevelUP adsPRO - AI Recommendation Spec v1

## 1. Tujuan

Dokumen ini mendefinisikan spesifikasi awal untuk modul `AI Recommendation` di `LevelUP adsPRO`. Fokus utamanya adalah menghasilkan rekomendasi yang:

- berguna untuk seller marketplace
- bisa dijelaskan alasannya
- tidak bergantung penuh pada LLM
- aman dijalankan pada fase MVP

## 2. Prinsip Dasar

- recommendation engine harus `rules-first`, bukan `LLM-first`
- LLM dipakai untuk explanation, summarization, dan conversational layer
- keputusan dasar tetap datang dari metric yang terukur
- setiap recommendation harus membawa alasan yang dapat diaudit
- recommendation tidak boleh muncul jika data tidak cukup atau kualitas data rendah
- sistem harus membedakan `suggestion`, `warning`, dan `decision support`

## 3. Scope MVP

Pada fase MVP, recommendation difokuskan ke:

- campaign performance
- product performance
- profit pressure
- break even analysis
- basic anomaly detection

Recommendation MVP belum mencakup:

- auto execution ke platform iklan
- auto bid change
- auto budget transfer
- autonomous campaign restructuring

## 4. Posisi Modul dalam Arsitektur

Alur recommendation yang disarankan:

```text
Raw Data
-> Normalization
-> Daily / Period Aggregation
-> Business Metrics
-> Rule Evaluation
-> Recommendation Object
-> LLM Explanation Layer
-> Dashboard / Alert / AI Chat
```

Artinya recommendation tidak membaca raw payload secara langsung kecuali untuk debugging.

## 5. Jenis Recommendation

### 5.1 Scale

Dipakai ketika campaign atau produk menunjukkan performa sehat dan layak didorong.

Contoh output:

- tambah budget
- pertahankan creative aktif
- dorong SKU dengan margin aman

### 5.2 Pause

Dipakai ketika spend berjalan tetapi profit atau efisiensi buruk.

Contoh output:

- pause campaign rugi
- hentikan ad set dengan spend boros

### 5.3 Reduce Bid

Dipakai ketika CPC terlalu tinggi dan menekan profitability.

### 5.4 Improve Creative

Dipakai ketika exposure tinggi tetapi CTR rendah.

### 5.5 Improve PDP

Dipakai ketika CTR cukup baik tetapi CVR lemah.

### 5.6 Protect Margin

Dipakai ketika revenue terlihat baik, tetapi biaya membuat profit tertekan.

### 5.7 Watchlist

Dipakai untuk kondisi yang belum cukup kuat menjadi aksi tegas, tetapi perlu dipantau.

### 5.8 Anomaly Alert

Dipakai ketika ada perubahan tidak normal, misalnya:

- spend melonjak
- revenue turun tajam
- ROAS jatuh mendadak

## 6. Recommendation Level

Setiap recommendation perlu memiliki level tindakan:

- `info`
- `watch`
- `action`
- `critical`

Panduan awal:

- `info`: insight ringan tanpa urgensi
- `watch`: perlu dipantau
- `action`: layak dikerjakan user
- `critical`: potensi kerugian signifikan jika dibiarkan

## 7. Target Entity

Recommendation dapat ditujukan ke:

- organization
- shop
- campaign
- product
- keyword

Pada MVP, prioritas target entity:

1. campaign
2. product
3. shop

## 8. Input Data Minimum

Recommendation engine membaca data dari layer agregasi yang sudah dibersihkan.

Input minimum:

- impressions
- clicks
- orders
- revenue
- ad_spend
- units_sold
- cogs
- marketplace_fee
- admin_fee
- shipping_subsidy
- packaging_cost
- affiliate_cost
- target_roas
- break_even_roas

Input tambahan yang berguna:

- previous period comparison
- campaign status
- product stock status
- product category
- capture completeness flag

## 9. Data Quality Gate

Recommendation tidak boleh diproduksi tanpa quality gate.

### Hard Gate

Recommendation diblok jika:

- entity identifier kosong
- period belum lengkap
- metric inti tidak dapat dihitung
- data shop tidak terkait ke tenant valid

### Soft Gate

Recommendation boleh tetap muncul, tetapi diberi tanda kualitas jika:

- COGS belum lengkap
- biaya tertentu masih estimasi
- volume data terlalu kecil
- hanya sebagian source yang sudah sinkron

Contoh flag:

- `final`
- `estimated`
- `insufficient_data`
- `partial_sync`

## 10. Rule Evaluation Model

Rule dievaluasi dalam tiga lapisan.

### 10.1 Eligibility Layer

Menentukan apakah entity layak dievaluasi.

Contoh:

- spend minimum tercapai
- impressions minimum tercapai
- age of campaign cukup

### 10.2 Diagnostic Layer

Mencari pola masalah atau peluang.

Contoh:

- CTR rendah
- CVR rendah
- ROAS tinggi
- profit negatif
- revenue growth tinggi

### 10.3 Action Layer

Mengubah diagnosis menjadi rekomendasi yang jelas.

Contoh:

- `low_ctr` -> `improve_creative`
- `negative_profit` -> `pause`
- `high_roas_and_positive_profit` -> `scale`

## 11. Rule Families

### 11.1 Efficiency Rules

Fokus pada efisiensi iklan.

Contoh sinyal:

- ROAS
- CPC
- CPM
- ad cost ratio

### 11.2 Profitability Rules

Fokus pada laba riil setelah biaya.

Contoh sinyal:

- net profit
- profit margin
- break even ROAS

### 11.3 Funnel Rules

Fokus pada titik lemah funnel.

Contoh:

- impressions tinggi, CTR rendah
- clicks tinggi, CVR rendah

### 11.4 Trend Rules

Fokus pada perubahan antar periode.

Contoh:

- revenue turun 30 persen
- spend naik 40 persen
- ROAS turun dua hari berturut-turut

### 11.5 Confidence Rules

Fokus pada validitas data.

Contoh:

- volume terlalu kecil
- source belum lengkap
- biaya masih estimasi

## 12. Baseline Threshold Model

Threshold awal disarankan memakai tiga sumber:

1. default global system
2. override per marketplace
3. override per shop atau per category

Contoh:

- minimum spend evaluasi campaign
- minimum clicks untuk membaca CVR
- target ROAS default per shop

## 13. Contoh Rule MVP

### 13.1 Scale

Rekomendasikan `scale` jika:

- `roas > target_roas`
- `net_profit > 0`
- `orders >= min_orders`
- `data_quality in [final, estimated]`

Contoh pseudocode:

```text
IF roas > target_roas
AND net_profit > 0
AND orders >= 3
AND ad_spend >= minimum_spend
THEN recommendation = scale
```

### 13.2 Pause

Rekomendasikan `pause` jika:

- `net_profit < 0`
- `ad_spend >= minimum_spend`
- data bukan low-volume noise

```text
IF net_profit < 0
AND ad_spend >= minimum_spend
AND clicks >= minimum_clicks
THEN recommendation = pause
```

### 13.3 Improve Creative

Rekomendasikan `improve_creative` jika:

- impressions cukup tinggi
- CTR di bawah threshold
- data klik belum cukup kuat untuk diagnosis CVR

```text
IF impressions >= minimum_impressions
AND ctr < ctr_threshold
THEN recommendation = improve_creative
```

### 13.4 Improve PDP

Rekomendasikan `improve_pdp` jika:

- CTR baik
- CVR lemah
- traffic cukup

```text
IF ctr >= ctr_good_threshold
AND cvr < cvr_threshold
AND clicks >= minimum_clicks
THEN recommendation = improve_pdp
```

### 13.5 Reduce Bid

Rekomendasikan `reduce_bid` jika:

- CPC tinggi
- ROAS rendah
- profit margin turun

### 13.6 Watchlist

Rekomendasikan `watchlist` jika:

- metric bergerak negatif
- tetapi belum cukup kuat untuk aksi tegas

## 14. Recommendation Priority and Conflict Resolution

Satu entity bisa memenuhi banyak rule. Karena itu sistem perlu urutan prioritas.

Prioritas awal:

1. `critical loss prevention`
2. `pause`
3. `protect_margin`
4. `reduce_bid`
5. `improve_pdp`
6. `improve_creative`
7. `scale`
8. `watchlist`

Contoh:

- jika entity layak `scale` tetapi profit negatif, maka `pause` harus menang
- jika data tidak cukup, keluarkan `watchlist` atau `insufficient_data`, bukan `scale`

## 15. Recommendation Object Schema

Output recommendation minimal perlu memiliki:

- `id`
- `organization_id`
- `shop_id`
- `marketplace`
- `entity_type`
- `entity_id`
- `period_start`
- `period_end`
- `recommendation_type`
- `severity`
- `title`
- `summary`
- `reason_codes`
- `metrics_snapshot`
- `data_quality`
- `status`
- `generated_at`

Contoh:

```json
{
  "id": "rec_001",
  "organization_id": "org_123",
  "shop_id": "shop_123",
  "marketplace": "shopee",
  "entity_type": "campaign",
  "entity_id": "cmp_001",
  "period_start": "2026-06-01",
  "period_end": "2026-06-07",
  "recommendation_type": "pause",
  "severity": "action",
  "title": "Pause campaign yang merugi",
  "summary": "Campaign menghabiskan biaya signifikan tetapi profit masih negatif.",
  "reason_codes": ["NEGATIVE_PROFIT", "LOW_ROAS", "HIGH_SPEND"],
  "metrics_snapshot": {
    "revenue": 1500000,
    "ad_spend": 420000,
    "net_profit": -80000,
    "roas": 3.57,
    "break_even_roas": 4.2
  },
  "data_quality": "final",
  "status": "open",
  "generated_at": "2026-06-14T10:00:00Z"
}
```

## 16. Reason Codes

Recommendation harus menyimpan kode alasan yang stabil agar:

- mudah diaudit
- mudah difilter di UI
- tidak bergantung pada wording LLM

Contoh reason code awal:

- `HIGH_ROAS`
- `LOW_ROAS`
- `NEGATIVE_PROFIT`
- `LOW_CTR`
- `LOW_CVR`
- `HIGH_CPC`
- `HIGH_SPEND`
- `BREAK_EVEN_RISK`
- `INSUFFICIENT_DATA`
- `PARTIAL_COST_DATA`

## 17. Explanation Layer

LLM dipakai setelah recommendation object terbentuk.

Tugas LLM:

- mengubah rule output menjadi bahasa natural
- menjelaskan penyebab utama
- menjelaskan dampak bisnis
- memberi saran tindakan lanjutan

LLM tidak boleh:

- mengubah `recommendation_type` utama tanpa dasar sistem
- mengarang metric yang tidak ada
- menghapus data quality warning

## 18. UI Display Rules

Di dashboard, recommendation sebaiknya menampilkan:

- title singkat
- severity
- entity target
- metric utama yang memicu
- data quality badge
- CTA sederhana

CTA awal:

- `Review Campaign`
- `Review Product`
- `Lihat Detail`
- `Snooze`
- `Mark as Done`

## 19. Recommendation Lifecycle

Status recommendation yang disarankan:

- `open`
- `acknowledged`
- `done`
- `dismissed`
- `expired`

Aturan awal:

- recommendation lama boleh `expired` jika kondisi pemicunya tidak lagi relevan
- recommendation yang sama tidak boleh terus muncul sebagai duplikasi tanpa perubahan context

## 20. Deduplication Policy

Sistem perlu mencegah spam recommendation.

Kunci deduplikasi awal:

- organization
- shop
- entity_type
- entity_id
- recommendation_type
- active evaluation window

Jika recommendation identik sudah terbuka:

- update snapshot metric
- tambah `last_seen_at`
- jangan buat record baru tanpa alasan

## 21. Feedback Loop

User feedback penting untuk iterasi model.

Feedback minimum:

- accepted
- rejected
- snoozed
- resolved

Alasan feedback opsional:

- tidak relevan
- datanya kurang lengkap
- sudah ditangani
- sarannya tidak sesuai konteks

## 22. Alert Integration

Recommendation tertentu bisa dikirim ke channel alert jika severity cukup tinggi.

Contoh:

- profit negatif besar
- spend melonjak abnormal
- ROAS jatuh di bawah threshold kritis

Namun pada MVP:

- notifikasi cukup ke in-app terlebih dahulu
- WhatsApp atau Telegram dapat masuk fase berikutnya

## 23. AI Chat Analyst Integration

AI chat analyst harus membaca recommendation object yang sudah ada.

Contoh query user:

- campaign mana yang harus saya pause
- produk mana yang layak scale
- kenapa profit turun

Jawaban AI sebaiknya:

- mengutip recommendation yang ada
- menjelaskan alasan
- memberi konteks tambahan

## 24. Safety and Product Guardrails

- sistem hanya memberi saran, bukan tindakan otomatis
- jangan klaim kepastian hasil masa depan
- tampilkan keterbatasan data jika input belum lengkap
- jangan mencampur data public market research ke recommendation toko tanpa pemisahan yang jelas
- recommendation profit tidak boleh muncul sebagai `final` jika COGS belum lengkap

## 25. Evaluation Metrics untuk Recommendation Engine

Metrik internal yang perlu dipantau:

- recommendation open rate
- acknowledgment rate
- acceptance rate
- dismissal rate
- stale recommendation rate
- false positive feedback rate
- time to action

## 26. Phase Roadmap Recommendation Engine

### Phase MVP

- rule-based recommendation
- explanation layer sederhana
- in-app display
- feedback capture dasar

### Phase 2

- anomaly detection lebih matang
- shop-specific threshold learning
- AI chat analyst terintegrasi penuh

### Phase 3

- recommendation ranking by impact score
- forecast-aware recommendation
- scenario simulation

## 27. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)
- [04-MVP-backlog-and-user-stories.md](file:///d:/levelup-adspro/docs/levelup-adspro/04-MVP-backlog-and-user-stories.md)
- [11-Analytics-formula-and-metrics-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/11-Analytics-formula-and-metrics-v1.md)
- [15-Data-retention-and-storage-policy-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/15-Data-retention-and-storage-policy-v1.md)

## 28. Open Questions

- apakah threshold default perlu dibedakan per objective campaign sejak MVP
- apakah rekomendasi perlu dihitung per hari, per jam, atau hybrid
- apakah satu entity boleh memiliki lebih dari satu recommendation aktif yang berbeda
- apakah user dapat menetapkan target ROAS per product dan per campaign secara terpisah sejak fase awal
