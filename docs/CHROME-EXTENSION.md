# Chrome Extension Packaging

Dokumen ini menjelaskan status, build, dan langkah packaging untuk Chrome extension `LevelUP adsPRO Collector`.

## Status Saat Ini

Extension sudah mencakup fondasi capture + riset Shopee, termasuk UI overlay di halaman publik:

- manifest v3 + packaging ZIP
- popup login (membuat `auth session` + `extension session` + heartbeat)
- background service worker (sync manual + heartbeat + throttling enrichment)
- content script (overlay riset market & riset produk)
- capture mode `public`:
  - Shopee public search (preview result + enrichment metrik publik)
  - Shopee public product (detail produk publik)
- kalkulator `ROAS | LevelUP adsPRO` pada halaman detail produk publik
- picker `Fee Kategori Produk` yang mengambil master data dari dashboard (settings)
- auto-saran kategori ROAS dari breadcrumb kategori Shopee publik, dengan fallback ke picker manual jika tidak ada match
- default `Jenis Toko` + `Promo Xtra` per shop yang dikelola di dashboard dan dipakai sebagai nilai awal modal ROAS
- program Shopee di modal ROAS ditampilkan ringkas sebagai `Promo Extra` dan `Ongkir Extra`, dengan detail biaya melalui tooltip
- gate `Login diperlukan` saat user membuka picker kategori tetapi belum login extension
- page debug panel disembunyikan untuk user (tetap bisa dibuka untuk dev dengan menghapus class `hidden` di `popup.html`)

Catatan izin akses (host permissions) sudah mencakup beberapa domain Shopee regional:

- `shopee.co.id`, `shopee.co.th`, `shopee.com.my`, `shopee.ph`, `shopee.sg`, `shopee.vn`
- `seller.shopee.co.id`, `seller.shopee.co.th`, `seller.shopee.com.my`, `seller.shopee.ph`, `seller.shopee.sg`, `seller.shopee.vn`

## Build

Jalankan dari root repo:

```bash
npm run build --workspace apps/extension
```

Hasil build ada di:

```text
apps/extension/dist
```

Dan file ZIP upload-ready dibuat di:

```text
apps/extension/package/levelup-adspro-collector-v<version>.zip
```

Output tersebut dipakai untuk:

- `Load unpacked` di browser
- upload ZIP ke Chrome Web Store

## Load Unpacked

1. Buka `chrome://extensions`
2. Aktifkan `Developer mode`
3. Klik `Load unpacked`
4. Pilih folder `apps/extension/dist`

## Uji Cepat

1. Login lewat popup extension (menggunakan akun LevelUP adsPRO dashboard)
2. Buka halaman Shopee search:
   - `https://shopee.co.id/search?keyword=serum`
3. Klik `Refresh Page State`
4. Klik `Sync Now` untuk mengirim ingestion batch ke backend

Uji kalkulator ROAS + fee kategori:

1. Pastikan di dashboard Settings sudah ada master `Fee Kategori Marketplace` untuk Shopee dan statusnya aktif
2. Pastikan di dashboard `Shops` sudah dipilih default `Jenis Toko (ROAS)` dan `Promo Xtra (ROAS)` untuk shop yang dipakai extension
3. Buka halaman detail produk Shopee publik
4. Klik `Kalkulator ROAS`
5. Verifikasi:
   - `Jenis Toko` mengikuti default shop aktif
   - toggle `Promo Extra` mengikuti default `Promo Xtra` shop aktif
   - toggle `Ongkir Extra` tersedia sebagai biaya tambahan `Gratis Ongkir XTRA (0.5%)`
   - kategori dapat terisi otomatis dari breadcrumb Shopee jika ditemukan di master fee
   - jika belum ada match, user tetap bisa memilih kategori manual
   - area `Kategori Produk` menampilkan helper text jika fee terisi otomatis atau jika match belum ditemukan di master
6. Hover kartu tier `Rugi / Kompetitif / Konservatif / Prospektif` untuk melihat penjelasan target ROAS
7. Hover title `Promo Extra` dan `Ongkir Extra` untuk melihat detail biaya program Shopee
8. Hover ikon `ⓘ` di `Biaya Shopee (Total)` untuk melihat rincian fee kategori, biaya proses pesanan, `Promo Extra`, dan `Ongkir Extra`
9. Verifikasi bagian bawah modal menampilkan `Biaya Shopee (Total)` dan `Profit Sebelum Iklan` dalam 1 baris 2 bagian
10. Ubah `HPP Produk`, `Operasional`, atau `Harga Jual` dan pastikan:
   - `Profit Sebelum Iklan` berubah realtime
   - nilai ROAS pada tiap tier ikut berubah realtime
   - nominal profit per tier ikut berubah realtime
11. Klik `Pilih Kategori` pada field `Kategori Produk`:
   - jika belum login, modal akan menampilkan `Login diperlukan` dan tombol `Login Sekarang`
   - jika sudah login, modal menampilkan daftar kategori sesuai jenis toko

Jika flow tidak sesuai, ulangi validasi dengan build extension terbaru:

```bash
npm run build --workspace apps/extension
```

Deploy aplikasi server tetap mengikuti panduan manual di `docs/DEPLOYMEN.md`; auto deploy polling tidak dipakai.

Jika berhasil, backend akan menerima `ingestion batch` dan menyimpan raw payload ke MinIO.

## Packaging Untuk Chrome Web Store

Setelah build selesai, upload file ZIP yang dibuat otomatis di folder `apps/extension/package` ke item Chrome Web Store.

Yang perlu Anda siapkan untuk listing:

- extension name
- short description
- detailed description
- screenshot
- icon final sudah ikut di package extension
- kategori extension
- privacy policy bila diminta oleh form listing

URL privacy policy publik untuk listing Chrome Web Store:

```text
https://adspro.naeva.id/privacy-policy
```

## Catatan

- Untuk development lokal, popup mendukung ganti `API Base URL`
- Default production endpoint: `https://adspro.naeva.id`
- Parser yang sudah dipakai untuk riset publik: `Shopee public search` dan `Shopee public product`
- Integrasi official marketplace OpenAPI belum menjadi bagian extension v1 ini
