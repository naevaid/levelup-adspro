# Chrome Extension Packaging

Dokumen ini menjelaskan status, build, dan langkah packaging untuk Chrome extension `LevelUP adsPRO Collector`.

## Status Saat Ini

Extension sudah mencakup fondasi Sprint 3:

- manifest v3
- popup shell
- background service worker
- content script shell
- login ke backend
- extension session + heartbeat
- page detection debug
- manual sync ke ingestion API

## Build

Jalankan dari root repo:

```bash
npm run build --workspace apps/extension
```

Hasil build ada di:

```text
apps/extension/dist
```

Folder ini yang dipakai untuk:

- `Load unpacked` di browser
- bahan zip upload ke Chrome Web Store

## Load Unpacked

1. Buka `chrome://extensions`
2. Aktifkan `Developer mode`
3. Klik `Load unpacked`
4. Pilih folder `apps/extension/dist`

## Uji Cepat

1. Login lewat popup extension
2. Buka halaman Shopee search, misalnya:
   - `https://shopee.co.id/search?keyword=serum`
3. Klik `Refresh Page State`
4. Pastikan popup menampilkan:
   - `page type`
   - `capture mode`
   - `marketplace`
   - `keyword`
5. Klik `Sync Now`

Jika berhasil, backend akan menerima `ingestion batch` dan menyimpan raw payload ke MinIO.

## Packaging Untuk Chrome Web Store

Setelah `dist` siap, buat zip dari isi folder `apps/extension/dist`, lalu upload ke item Chrome Web Store.

Yang perlu Anda siapkan untuk listing:

- extension name
- short description
- detailed description
- screenshot
- icon final
- kategori extension
- privacy policy bila diminta oleh form listing

## Catatan

- Untuk development lokal, popup mendukung ganti `API Base URL`
- Default production endpoint: `https://adspro.naeva.id`
- Parser MVP yang paling siap saat ini adalah `Shopee public search`
- Integrasi official marketplace OpenAPI belum menjadi bagian extension v1 ini
