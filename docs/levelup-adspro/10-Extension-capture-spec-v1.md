# LevelUP adsPRO - Extension Capture Spec v1

## 1. Tujuan

Dokumen ini mendefinisikan perilaku minimum Chrome Extension untuk `LevelUP adsPRO` pada fase awal. Tujuannya adalah menjelaskan apa yang perlu dideteksi, data apa yang boleh ditangkap, dan bagaimana payload dikirim ke backend.

Fokus v1:

- owned data capture untuk toko sendiri
- public market intelligence capture untuk riset keyword marketplace

## 2. Prinsip Dasar

- extension adalah `collector`, bukan tempat analytics utama
- extension harus membedakan mode `owned` dan `public`
- semua payload harus memiliki metadata source yang jelas
- extension harus meminimalkan duplicate capture
- payload tidak boleh dikirim tanpa tenant context jika user ingin menyimpan data

## 3. Capture Modes

### 3.1 Owned Data Capture

Dipakai saat user membuka:

- dashboard seller
- dashboard ads
- halaman performa campaign
- halaman produk di area seller

Tujuan:

- mengambil data toko sendiri untuk analytics, profit, dan recommendation

### 3.2 Public Market Intelligence Capture

Dipakai saat user membuka:

- hasil pencarian marketplace publik
- listing produk publik
- halaman produk kompetitor yang datanya terlihat publik

Tujuan:

- mengambil data keyword, produk, harga, dan sinyal penjualan yang terlihat

## 4. Extension Components

### Content Script

Tugas:

- membaca DOM halaman target
- mendeteksi page type
- mengambil data yang terlihat
- mengirim hasil parsing ke background script

### Background Script

Tugas:

- menyimpan session extension
- mengatur queue retry
- menambahkan metadata tenant
- mengirim payload ke backend

### Popup UI

Tugas:

- login atau logout extension
- menampilkan status user
- menampilkan status shop atau page detection
- trigger manual sync

## 5. Page Detection Rules

Setiap page yang didukung harus diklasifikasikan minimal menjadi:

- `shopee_ads_dashboard`
- `shopee_seller_product_page`
- `shopee_public_search`
- `shopee_public_product`
- `tiktok_ads_dashboard`
- `tiktok_public_search`
- `unknown`

Deteksi ini penting karena:

- schema payload bergantung pada page type
- parser yang dipakai bergantung pada page type
- backend perlu tahu capture mode dan source page

## 6. Minimum Metadata untuk Semua Payload

Setiap payload yang dikirim extension minimal harus membawa:

- `capture_mode`
- `page_type`
- `marketplace`
- `captured_at`
- `extension_version`
- `browser_name`
- `url`
- `organization_id` jika user login
- `shop_id` jika owned data dan shop sudah diketahui
- `session_id`
- `payload_schema_version`

## 7. Owned Data Payload Spec

### Tujuan

Menyimpan snapshot data performa toko sendiri.

### Field Minimum

- `capture_mode = owned`
- `page_type`
- `marketplace`
- `shop_identifier`
- `campaigns[]` atau `products[]` atau `metrics[]`
- `currency`
- `captured_at`

### Contoh Struktur Ringkas

```json
{
  "capture_mode": "owned",
  "page_type": "shopee_ads_dashboard",
  "marketplace": "shopee",
  "shop_identifier": "shop-123",
  "captured_at": "2026-06-14T10:00:00Z",
  "payload_schema_version": "1.0",
  "metrics": [
    {
      "object_type": "campaign",
      "object_id": "cmp-001",
      "name": "GMV Max Product A",
      "impressions": 10000,
      "clicks": 230,
      "orders": 14,
      "revenue": 3500000,
      "ad_spend": 420000
    }
  ]
}
```

## 8. Public Search Payload Spec

### Tujuan

Menyimpan hasil riset keyword dan observasi produk publik.

### Field Minimum

- `capture_mode = public`
- `page_type = shopee_public_search` atau setara
- `marketplace`
- `keyword`
- `captured_at`
- `results[]`

### Struktur `results[]`

Setiap result minimal berisi:

- `position`
- `product_title`
- `product_url`
- `shop_name`
- `price_min`
- `price_max`
- `sales_hint`

### Contoh Struktur Ringkas

```json
{
  "capture_mode": "public",
  "page_type": "shopee_public_search",
  "marketplace": "shopee",
  "keyword": "serum wajah",
  "captured_at": "2026-06-14T10:05:00Z",
  "payload_schema_version": "1.0",
  "results": [
    {
      "position": 1,
      "product_title": "Serum Wajah Brightening",
      "product_url": "https://shopee.co.id/...",
      "shop_name": "Glow Official",
      "price_min": 35000,
      "price_max": 49000,
      "sales_hint": "10RB+ terjual"
    }
  ]
}
```

## 9. Sync Triggers

### Manual Sync

Dipicu oleh user dari popup extension.

Dipakai untuk:

- memastikan data terbaru masuk
- debugging parser
- menyimpan session riset keyword tertentu

### Auto Sync

Dipicu saat page target dibuka dan lolos throttle.

Dipakai untuk:

- mempermudah owned data sync
- mempermudah riset market tanpa langkah manual berulang

### Background Retry

Dipakai jika pengiriman gagal karena:

- koneksi terputus
- timeout
- error server sementara

## 10. Throttling Rules

Untuk mencegah spam:

- page yang sama tidak boleh dikirim terus-menerus dalam jeda sangat pendek
- payload yang hash-nya identik tidak perlu dikirim ulang
- public search capture sebaiknya hanya dikirim saat keyword atau hasil berubah

## 11. Queue and Retry Rules

Background script sebaiknya memiliki queue lokal dengan metadata:

- payload id
- capture mode
- created at
- retry count
- last error

Aturan:

- retry maksimum terbatas
- jika masih gagal, user dapat melihat status gagal
- payload gagal tidak langsung dibuang

## 12. Security Rules

- extension login wajib memakai token khusus extension
- token tidak boleh ditulis sembarang ke local storage tanpa proteksi minimum
- payload harus dikirim lewat HTTPS
- data sensitif toko sendiri harus dibatasi hanya untuk backend tenant yang benar

## 13. UX Minimum

Popup extension minimal menampilkan:

- status login
- current organization
- page type terdeteksi
- shop terdeteksi bila ada
- tombol `Sync Now`
- status sukses atau gagal terakhir

## 14. Parser Strategy

### Parser Owned

Karakteristik:

- fokus pada dashboard internal seller
- field lebih dekat ke analytics dan performance

### Parser Public

Karakteristik:

- fokus pada elemen publik
- lebih rapuh terhadap perubahan DOM
- wajib toleran pada field yang kadang tidak muncul

Prinsip:

- parser harus modular per page type
- jangan satu parser besar untuk semua halaman

## 15. Backend Contract Notes

Backend harus menerima payload dengan:

- `capture_mode`
- `page_type`
- `payload_schema_version`

Karena ketiga field ini menjadi dasar:

- routing parser backend
- storage policy
- retention policy

## 16. Error States

Extension harus bisa membedakan:

- user belum login sistem
- token expired
- page tidak didukung
- shop tidak terdeteksi
- server gagal menerima payload
- parser gagal membaca page

## 17. Open Questions

- apakah preview hasil riset keyword perlu tampil di popup extension
- apakah signed upload ke object storage perlu sejak v1
- apakah public capture disimpan otomatis atau harus eksplisit dipilih user
- apakah ranking position disimpan penuh atau hanya top N pertama
