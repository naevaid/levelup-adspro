# LevelUP adsPRO - Dashboard Data Contract v1

## 1. Tujuan

Dokumen ini mendefinisikan kontrak data awal untuk dashboard `LevelUP adsPRO` agar backend, frontend, dan AI layer memakai bentuk response yang konsisten.

Fokus v1:

- overview dashboard
- freshness and data quality
- top and worst campaign
- top and worst product
- recommendation summary
- market research summary dasar

## 2. Prinsip Dasar

- dashboard membaca data agregat, bukan raw payload
- semua response tenant-bound harus terkait ke `organization_id`
- semua angka penting harus membawa konteks `data_quality`
- semua blok dashboard harus tahan terhadap kondisi `empty`, `partial`, dan `stale`
- kontrak response harus stabil walau sumber data bertambah

## 3. Konsep Response Dashboard

Setiap response dashboard disarankan memiliki envelope yang seragam.

Contoh struktur umum:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "organization_id": "org_123",
    "shop_id": "shop_123",
    "marketplace": "shopee",
    "date_from": "2026-06-01",
    "date_to": "2026-06-07",
    "timezone": "Asia/Jakarta",
    "currency": "IDR",
    "generated_at": "2026-06-14T10:00:00Z"
  }
}
```

## 4. Common Metadata Contract

Field metadata yang sebaiknya tersedia pada mayoritas endpoint dashboard:

- `organization_id`
- `shop_id`
- `marketplace`
- `date_from`
- `date_to`
- `timezone`
- `currency`
- `generated_at`
- `last_synced_at`
- `data_quality`

### `data_quality`

Nilai awal yang disarankan:

- `final`
- `estimated`
- `partial_sync`
- `insufficient_data`

### `currency`

- untuk MVP, currency mengikuti mata uang utama shop
- bila dashboard lintas shop memiliki currency campuran, blok ringkasan harus diberi peringatan atau dibatasi

## 5. Filter Contract

Dashboard v1 minimal mendukung filter berikut:

- `organization_id` dari session aktif
- `shop_id`
- `marketplace`
- `date_from`
- `date_to`
- `compare_mode`

`compare_mode` contoh nilai:

- `previous_period`
- `none`

## 6. KPI Card Contract

KPI card dipakai untuk angka inti di overview dashboard.

Struktur umum:

```json
{
  "key": "revenue",
  "label": "Revenue",
  "value": 12500000,
  "formatted_value": "Rp12.500.000",
  "change_ratio": 0.18,
  "change_label": "+18%",
  "direction": "up",
  "data_quality": "final",
  "is_estimated": false
}
```

Field:

- `key`
- `label`
- `value`
- `formatted_value`
- `change_ratio`
- `change_label`
- `direction`
- `data_quality`
- `is_estimated`

## 7. Overview Dashboard Contract

Endpoint target:

- `GET /api/v1/dashboard/overview`

Response disarankan:

```json
{
  "ok": true,
  "data": {
    "summary_cards": [
      {
        "key": "revenue",
        "label": "Revenue",
        "value": 12500000,
        "formatted_value": "Rp12.500.000",
        "change_ratio": 0.18,
        "change_label": "+18%",
        "direction": "up",
        "data_quality": "final",
        "is_estimated": false
      },
      {
        "key": "ad_spend",
        "label": "Ad Spend",
        "value": 2200000,
        "formatted_value": "Rp2.200.000",
        "change_ratio": 0.05,
        "change_label": "+5%",
        "direction": "up",
        "data_quality": "final",
        "is_estimated": false
      }
    ],
    "highlights": {
      "top_campaign_count": 3,
      "critical_recommendation_count": 2,
      "stale_shop_count": 0
    },
    "charts": {
      "revenue_trend": [],
      "spend_trend": [],
      "roas_trend": [],
      "profit_trend": []
    }
  },
  "meta": {
    "organization_id": "org_123",
    "shop_id": "shop_123",
    "marketplace": "shopee",
    "date_from": "2026-06-01",
    "date_to": "2026-06-07",
    "timezone": "Asia/Jakarta",
    "currency": "IDR",
    "generated_at": "2026-06-14T10:00:00Z",
    "last_synced_at": "2026-06-14T09:55:00Z",
    "data_quality": "final"
  }
}
```

## 8. Trend Series Contract

Chart time-series sebaiknya memakai struktur seragam.

```json
{
  "key": "revenue_trend",
  "granularity": "day",
  "points": [
    {
      "date": "2026-06-01",
      "value": 1500000,
      "formatted_value": "Rp1.500.000",
      "data_quality": "final"
    }
  ]
}
```

Field:

- `key`
- `granularity`
- `points[]`

Field point:

- `date`
- `value`
- `formatted_value`
- `data_quality`

## 9. Freshness Contract

Endpoint target:

- `GET /api/v1/dashboard/freshness`

Response:

```json
{
  "ok": true,
  "data": {
    "shops": [
      {
        "shop_id": "shop_123",
        "shop_name": "Shopee A",
        "marketplace": "shopee",
        "last_synced_at": "2026-06-14T09:55:00Z",
        "freshness_status": "fresh",
        "capture_sources": ["owned", "public"],
        "data_quality": "final"
      }
    ]
  },
  "meta": {
    "organization_id": "org_123",
    "generated_at": "2026-06-14T10:00:00Z"
  }
}
```

`freshness_status` nilai awal:

- `fresh`
- `delayed`
- `stale`
- `never_synced`

## 10. Top and Worst Campaign Contract

Endpoint target:

- `GET /api/v1/analytics/campaigns/top`
- `GET /api/v1/analytics/campaigns/worst`

Struktur item:

```json
{
  "campaign_id": "cmp_001",
  "campaign_name": "GMV Max Serum",
  "revenue": 5200000,
  "ad_spend": 700000,
  "roas": 7.43,
  "net_profit": 1250000,
  "orders": 42,
  "reason_codes": ["HIGH_ROAS", "POSITIVE_PROFIT"],
  "data_quality": "final"
}
```

Response list:

```json
{
  "ok": true,
  "data": {
    "items": []
  },
  "meta": {
    "organization_id": "org_123",
    "shop_id": "shop_123",
    "date_from": "2026-06-01",
    "date_to": "2026-06-07",
    "sort_basis": "net_profit",
    "data_quality": "final"
  }
}
```

## 11. Top and Worst Product Contract

Endpoint target:

- `GET /api/v1/analytics/products/top`
- `GET /api/v1/analytics/products/worst`

Struktur item:

```json
{
  "product_id": "prd_001",
  "product_name": "Serum Wajah",
  "sku": "SERUM-01",
  "revenue": 4100000,
  "ad_spend": 450000,
  "roas": 9.11,
  "net_profit": 980000,
  "units_sold": 75,
  "reason_codes": ["HIGH_ROAS", "FAST_MOVING"],
  "data_quality": "estimated"
}
```

## 12. Recommendation Summary Contract

Dashboard overview tidak selalu perlu membaca seluruh recommendation detail. Untuk hero panel, gunakan summary contract.

```json
{
  "critical_count": 2,
  "action_count": 5,
  "watch_count": 4,
  "top_items": [
    {
      "recommendation_id": "rec_001",
      "recommendation_type": "pause",
      "severity": "critical",
      "title": "Pause campaign yang merugi",
      "entity_type": "campaign",
      "entity_id": "cmp_001",
      "data_quality": "final"
    }
  ]
}
```

## 13. Recommendation Detail Card Contract

Dipakai untuk halaman atau panel `Recommendations`.

```json
{
  "recommendation_id": "rec_001",
  "recommendation_type": "pause",
  "severity": "critical",
  "title": "Pause campaign yang merugi",
  "summary": "Campaign menghabiskan biaya signifikan tetapi profit masih negatif.",
  "entity_type": "campaign",
  "entity_id": "cmp_001",
  "entity_name": "GMV Max Serum",
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

## 14. Market Research Summary Contract

Dipakai untuk kartu ringkasan `Market Research` di dashboard atau halaman research.

```json
{
  "session_id": "mrs_001",
  "keyword": "serum wajah",
  "marketplace": "shopee",
  "captured_at": "2026-06-14T09:40:00Z",
  "result_count": 40,
  "visible_price_min": 35000,
  "visible_price_max": 89000,
  "median_visible_price": 49000,
  "repeated_shop_count": 7,
  "saved": true
}
```

## 15. Empty State Contract

Agar frontend mudah konsisten, response empty sebaiknya tetap mengembalikan struktur stabil.

Contoh:

```json
{
  "ok": true,
  "data": {
    "items": [],
    "empty_state": {
      "code": "NO_SYNC_DATA",
      "title": "Belum ada data",
      "description": "Tambahkan shop atau lakukan sync dari extension untuk mulai melihat analytics."
    }
  },
  "meta": {
    "organization_id": "org_123",
    "generated_at": "2026-06-14T10:00:00Z"
  }
}
```

`empty_state.code` contoh nilai:

- `NO_SYNC_DATA`
- `NO_CONNECTED_SHOP`
- `NO_MARKET_RESEARCH_SESSION`
- `INSUFFICIENT_DATE_RANGE`

## 16. Error Contract

Untuk API dashboard, error response minimum:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "Rentang tanggal tidak valid."
  }
}
```

Contoh `error.code`:

- `INVALID_DATE_RANGE`
- `SHOP_NOT_FOUND`
- `ACCESS_DENIED`
- `UNSUPPORTED_MARKETPLACE`
- `INSUFFICIENT_PLAN`

## 17. Frontend Display Notes

- `formatted_value` disediakan backend untuk konsistensi cepat, tetapi frontend tetap boleh format ulang bila perlu
- `reason_codes` harus ikut response agar UI dan AI chat dapat membaca alasan yang stabil
- `data_quality` wajib tampil sebagai badge pada angka sensitif seperti profit dan recommendation
- `last_synced_at` perlu terlihat minimal di overview, shops, dan recommendation area

## 18. Compatibility Rules

- field baru boleh ditambah selama tidak merusak struktur utama
- field lama tidak boleh diganti nama tanpa versioning
- semua list wajib tetap berupa array walau kosong
- semua entity utama wajib punya `id` yang stabil

## 19. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)
- [11-Analytics-formula-and-metrics-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/11-Analytics-formula-and-metrics-v1.md)
- [13-UI-information-architecture-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/13-UI-information-architecture-v1.md)
- [16-AI-recommendation-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/16-AI-recommendation-spec-v1.md)

## 20. Open Questions

- apakah `overview` perlu mendukung multi-shop aggregate sejak MVP awal atau fokus single-shop dulu
- apakah semua chart perlu `compare_series` sejak v1 atau cukup satu seri utama
- apakah `formatted_value` lebih baik dihitung di frontend agar lebih fleksibel untuk locale
- apakah `market research` perlu kontrak dashboard terpisah dari analytics toko sejak awal
