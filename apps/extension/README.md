# LevelUP adsPRO Chrome Extension

Chrome extension ini adalah collector awal untuk Sprint 3:

- login ke backend `LevelUP adsPRO`
- membuat extension session
- heartbeat berkala
- page detection dasar Shopee dan TikTok
- manual sync ke ingestion API

## Script

```bash
npm run build --workspace apps/extension
npm run dev --workspace apps/extension
npm run lint --workspace apps/extension
```

Output build ada di `apps/extension/dist`.

## Load Unpacked

1. Jalankan build:

```bash
npm run build --workspace apps/extension
```

2. Buka `chrome://extensions`
3. Aktifkan `Developer mode`
4. Klik `Load unpacked`
5. Pilih folder `apps/extension/dist`

## Flow Penggunaan

1. Login dengan akun `LevelUP adsPRO`
2. Extension membuat session baru ke endpoint `/api/v1/extension/session`
3. Buka halaman marketplace yang didukung
4. Klik `Refresh Page State` bila perlu
5. Klik `Sync Now`

## Support Saat Ini

- `shopee_public_search`
- `shopee_ads_dashboard`
- `shopee_seller_product_page`
- `tiktok_ads_dashboard`
- `tiktok_public_search`

Parser yang paling siap dipakai saat ini adalah `shopee_public_search`.

## Catatan Chrome Web Store

Code package sudah siap untuk `Load unpacked` dan bisa dijadikan basis upload ke Chrome Web Store.

Sebelum publish listing, tetap siapkan:

- ikon extension final
- screenshot listing
- deskripsi store
- privacy policy / data disclosure bila diperlukan
