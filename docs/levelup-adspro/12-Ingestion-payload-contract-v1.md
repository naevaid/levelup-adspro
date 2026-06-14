# LevelUP adsPRO - Ingestion Payload Contract v1

## 1. Tujuan

Dokumen ini mendefinisikan kontrak payload v1 antara Chrome Extension dan backend ingestion `LevelUP adsPRO`.

Tujuan utamanya:

- memastikan schema payload konsisten
- memisahkan mode `owned` dan `public`
- memudahkan validasi backend
- memudahkan versioning parser saat UI marketplace berubah

## 2. Prinsip Kontrak

- semua payload harus membawa metadata inti yang sama
- payload `owned` dan `public` harus dibedakan jelas
- payload mentah boleh fleksibel, tetapi envelope utamanya harus stabil
- backend tidak boleh menebak `capture_mode` atau `page_type`
- schema harus versioned

## 3. Envelope Umum

Setiap payload wajib dibungkus dalam envelope berikut:

```json
{
  "capture_mode": "owned",
  "page_type": "shopee_ads_dashboard",
  "marketplace": "shopee",
  "payload_schema_version": "1.0",
  "captured_at": "2026-06-14T10:00:00Z",
  "source_url": "https://seller.shopee.co.id/...",
  "session_id": "ext-session-123",
  "organization_id": "org_123",
  "shop_id": "shop_123",
  "device": {
    "extension_version": "1.0.0",
    "browser_name": "chrome"
  },
  "content": {}
}
```

## 4. Required Root Fields

### `capture_mode`

Allowed values:

- `owned`
- `public`

### `page_type`

Contoh values:

- `shopee_ads_dashboard`
- `shopee_seller_product_page`
- `shopee_public_search`
- `shopee_public_product`
- `tiktok_ads_dashboard`
- `tiktok_public_search`

### `marketplace`

Allowed values:

- `shopee`
- `tiktok_shop`

### `payload_schema_version`

Contoh:

- `1.0`
- `1.1`

### `captured_at`

Format:

- ISO-8601 UTC timestamp

### `source_url`

URL halaman yang dibaca extension.

### `session_id`

Identifier session extension aktif.

### `organization_id`

Wajib ada jika user login dan ingin menyimpan data ke tenant.

### `shop_id`

Wajib untuk `owned` jika shop sudah dapat dipetakan.

## 5. Optional Root Fields

- `trace_id`
- `shop_identifier`
- `shop_name`
- `capture_reason`
- `request_id`
- `locale`

## 6. Device Metadata

Objek `device` minimal berisi:

```json
{
  "extension_version": "1.0.0",
  "browser_name": "chrome"
}
```

Optional:

- `os_name`
- `device_id`

## 7. Payload Type A - Owned Metrics Snapshot

### Tujuan

Mengirim snapshot performa toko sendiri untuk analytics.

### Minimum Content Contract

```json
{
  "content": {
    "shop": {
      "external_shop_id": "abc123",
      "shop_name": "My Shop"
    },
    "metrics": [
      {
        "object_type": "campaign",
        "object_id": "cmp_001",
        "name": "Campaign A",
        "impressions": 10000,
        "clicks": 220,
        "orders": 12,
        "units_sold": 15,
        "revenue": 2500000,
        "ad_spend": 320000,
        "currency": "IDR"
      }
    ]
  }
}
```

### Allowed `object_type`

- `campaign`
- `ad_group`
- `product`
- `shop`

## 8. Payload Type B - Public Search Capture

### Tujuan

Mengirim hasil riset keyword dari halaman pencarian publik marketplace.

### Minimum Content Contract

```json
{
  "content": {
    "keyword": "serum wajah",
    "results": [
      {
        "position": 1,
        "product_title": "Serum Brightening",
        "product_url": "https://shopee.co.id/...",
        "shop_name": "Glow Official",
        "price_min": 35000,
        "price_max": 49000,
        "sales_hint": "10RB+ terjual"
      }
    ]
  }
}
```

### Field Notes

- `position` adalah ranking hasil saat capture
- `sales_hint` adalah string atau angka hasil normalisasi dari tampilan publik
- `price_min` dan `price_max` dipakai untuk mendukung range harga

## 9. Payload Type C - Public Product Capture

### Tujuan

Mengirim snapshot dari halaman produk publik individual jika nanti parser mendukungnya.

### Minimum Content Contract

```json
{
  "content": {
    "product_title": "Serum Brightening",
    "product_url": "https://shopee.co.id/...",
    "shop_name": "Glow Official",
    "price_min": 35000,
    "price_max": 49000,
    "sales_hint": "10RB+ terjual",
    "rating_hint": "4.9",
    "review_count_hint": "1200"
  }
}
```

## 10. Capture Reason

Field `capture_reason` dapat membantu observability.

Contoh value:

- `manual_sync`
- `auto_sync`
- `page_change`
- `background_retry`
- `save_research`

## 11. Backend Validation Rules

Backend wajib memvalidasi:

- `capture_mode` valid
- `page_type` sesuai daftar yang diizinkan
- `payload_schema_version` dikenal
- `captured_at` valid
- `organization_id` ada jika payload ingin disimpan sebagai data tenant
- `shop_id` ada untuk flow owned yang memang membutuhkan tenant shop

Jika validasi gagal:

- respon harus konsisten
- payload boleh tetap di-log untuk debugging bila aman

## 12. Idempotency Rules

Extension sebaiknya mengirim:

- `payload_hash`
- `idempotency_key`

Jika belum dikirim, backend dapat membentuk hash sendiri dari:

- `capture_mode`
- `page_type`
- `source_url`
- `captured_at`
- isi `content`

## 13. Response Contract

Backend minimal mengembalikan:

```json
{
  "ok": true,
  "batch_id": "ing_123",
  "status": "accepted",
  "message": "Payload accepted"
}
```

Jika gagal:

```json
{
  "ok": false,
  "status": "rejected",
  "message": "Unknown page_type"
}
```

## 14. Storage Routing Rules

### Jika `capture_mode = owned`

Simpan sebagai:

- ingestion batch tenant
- raw payload object tenant
- source untuk analytics pipeline

### Jika `capture_mode = public`

Simpan sebagai:

- research capture batch
- raw research snapshot
- source untuk market intelligence pipeline

## 15. Versioning Strategy

Setiap perubahan struktur payload harus:

- menaikkan `payload_schema_version`
- menjaga backward compatibility bila mungkin
- mendokumentasikan perubahan parser yang diperlukan

## 16. Error Codes yang Disarankan

- `INVALID_CAPTURE_MODE`
- `INVALID_PAGE_TYPE`
- `INVALID_SCHEMA_VERSION`
- `MISSING_ORGANIZATION_ID`
- `MISSING_SHOP_ID`
- `INVALID_CONTENT`
- `UNAUTHORIZED_EXTENSION`
- `DUPLICATE_PAYLOAD`

## 17. Open Questions

- apakah `organization_id` perlu selalu datang dari extension atau cukup di-resolve dari token
- apakah `shop_id` perlu diisi extension atau cukup `shop_identifier`
- apakah `sales_hint` publik disimpan sebagai raw string plus normalized number sekaligus
- apakah payload besar perlu dipecah menjadi metadata dan raw blob terpisah sejak v1
