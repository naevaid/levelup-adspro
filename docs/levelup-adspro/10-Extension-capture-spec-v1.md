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

### Page Bridge (Injected Script)

Untuk beberapa halaman marketplace (terutama Shopee public search), request ke endpoint publik dapat memberikan hasil berbeda tergantung konteks request (page context vs extension background). Untuk itu extension dapat menyisipkan script ringan (page bridge) agar request dilakukan dari konteks halaman.

Catatan penting:

- page bridge harus konservatif (batch kecil, delay, concurrency rendah) untuk mengurangi risiko proteksi traffic marketplace (misalnya redirect ke `/verify/traffic/error`).
- jika page bridge gagal, extension harus bisa fallback ke mode aman (background fetch) walau datanya mungkin lebih minim.

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

Catatan:

- panel debug untuk page snapshot dapat disembunyikan untuk user (opsional), namun tetap berguna untuk development.

### Public Product Overlay dan Kalkulator ROAS

Pada halaman detail produk Shopee publik, extension dapat menampilkan modal `Kalkulator ROAS | LevelUP adsPRO` sebagai alat bantu estimasi cepat.

Perilaku minimum:

- `Jenis Toko` dan `Promo Xtra` dapat memakai default per shop dari dashboard
- kategori produk dapat dipilih manual dari master fee kategori tenant-scoped
- extension boleh mencoba auto-saran kategori dari breadcrumb kategori Shopee publik
- jika auto-match tidak ditemukan, user tetap harus bisa override manual
- rincian biaya marketplace (fee kategori, biaya proses pesanan, Promo Xtra) dijelaskan melalui tooltip / help UI agar layout tetap ringkas
- nilai tier ROAS di modal harus dihitung realtime dari input user, bukan hard-coded statis

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

## 8A. Public Product Payload Spec

### Tujuan

Menyimpan snapshot detail produk publik (kompetitor) untuk kebutuhan riset produk.

### Field Minimum

- `capture_mode = public`
- `page_type = shopee_public_product` atau setara
- `marketplace`
- `page_title`
- `product` (ringkas)

### Struktur `product` (ringkas)

- `product_title`
- `product_url`
- `image_url` (opsional)
- `shop_name` (opsional)
- `price_min` / `price_max` (opsional)
- `sales_hint` (opsional)
- `monthly_sold_hint` (opsional)
- `rating_hint` (opsional)
- `review_count_hint` (opsional)

### Contoh Struktur Ringkas

```json
{
  "capture_mode": "public",
  "page_type": "shopee_public_product",
  "marketplace": "shopee",
  "captured_at": "2026-06-14T11:30:00Z",
  "payload_schema_version": "1.0",
  "page_title": "Produk - Shopee",
  "product": {
    "product_title": "Parfum Pria ...",
    "product_url": "https://shopee.co.id/...",
    "shop_name": "Brand Official",
    "price_min": 119000,
    "price_max": 119000,
    "sales_hint": "4RB+ Terjual",
    "monthly_sold_hint": "587 Terjual/Bln",
    "rating_hint": "4.9",
    "review_count_hint": "12RB Ulasan"
  },
  "highlights": []
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

Catatan khusus marketplace publik:

- enrichment data publik (contoh: `monthly_sold_hint`) sebaiknya menggunakan batch kecil + delay.
- terlalu agresif dapat memicu proteksi traffic marketplace (contoh Shopee redirect ke `/verify/traffic/error`).

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

Catatan non-goals:

- Kalkulator ROAS di overlay detail produk adalah alat bantu UI (client-side) dan tidak wajib dikirim sebagai ingestion payload.
- Fee kategori marketplace dikelola di dashboard (Settings) agar mudah diupdate ketika marketplace mengubah persentase fee; extension hanya membaca lewat API saat user login.
- Kalkulator ROAS di extension adalah estimator cepat berbasis input user + master fee dashboard, bukan pengganti analytics historis dashboard.

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
