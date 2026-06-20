# Debug Session: payment-callback-401

Status: [OPEN]

## Gejala

- Callback dari `payment.naeva.id` ke `POST /api/billing/payment/callback` masih membalas `401`
- Response body:
  - `{"message":"Signature callback payment tidak valid.","error":"Unauthorized","statusCode":401}`

## Ekspektasi

- Callback forwarding dari `payment.naeva.id` diterima backend `adspro.naeva.id`
- Signature callback tervalidasi
- Endpoint membalas `2xx`

## Hipotesis Awal

1. Format `X-Payment-Signature` callback bukan `hex`, tetapi bentuk lain seperti `base64` atau canonical string berbeda.
2. Signature callback tidak dihitung dari `raw payload` saja, melainkan mengikutkan field lain seperti `timestamp`, `app_id`, atau path dengan format yang berbeda dari asumsi backend.
3. `PAYMENT_SECRET_KEY` yang aktif di server production tidak sama dengan secret project yang dipakai oleh `payment.naeva.id` saat mengirim callback.
4. `payment.naeva.id` menggunakan `default_callback_url`/project profile lain atau `app_id` lain saat forwarding, sehingga request yang masuk valid untuk project berbeda.
5. Payload callback yang diterima backend berubah bentuk saat melewati proxy/server sehingga `rawBody` yang diverifikasi tidak identik dengan body yang ditandatangani.

## Rencana Bukti

- Ambil bukti runtime dari `GET /projects/me`
- Baca log API production untuk request callback terbaru
- Cek data callback delivery yang terekam di database
- Bandingkan `app_id`, readiness profile, dan callback config yang aktif

## Catatan

- Pada sesi debug ini, tahap awal hanya pengumpulan bukti runtime
- Tidak ada perubahan logic baru sampai bukti runtime cukup

## Bukti Runtime

- `GET /projects/me` dengan `APP-FI4YVWSGZHXN` dan secret project berhasil `200`
- Project readiness dari `payment.naeva.id` berstatus `ready`
- `default_callback_url` project menunjuk ke `https://adspro.naeva.id/api/billing/payment/callback`
- Callback test terbaru masuk ke backend dengan `app_id` yang benar
- Record callback delivery menunjukkan `app_id_matches_expected=false`
- Inspect runtime container `levelup-adspro-api` menunjukkan:
  - `PAYMENT_APP_ID=` kosong
  - `PAYMENT_BASE_URL=` kosong
  - `BILLING_CALLBACK_URL=` kosong
  - `PAYMENT_SECRET_KEY` tidak ada

## Kesimpulan Sementara

Hipotesis yang terkonfirmasi:

1. Konfigurasi env payment tidak diteruskan ke container `api` pada deployment VPS.

Hipotesis yang ditolak:

1. App ID / secret project salah total.
2. Default callback URL di project payment salah.

## Fix Minimal

- Tambahkan `PAYMENT_BASE_URL`, `PAYMENT_APP_ID`, `PAYMENT_SECRET_KEY`, dan `BILLING_CALLBACK_URL` ke `environment` service `api` di `docker-compose.vps.yml`

## Bukti Lanjutan

- Restart stack VPS penuh sudah berhasil dan `levelup-adspro-api` aktif dengan env:
  - `PAYMENT_BASE_URL`
  - `PAYMENT_APP_ID`
  - `PAYMENT_SECRET_KEY`
  - `BILLING_CALLBACK_URL`
- Callback test terbaru setelah restart masih `401`
- Record callback terbaru menunjukkan:
  - `app_id_matches_expected=true`
  - `raw_body_present=true`
  - `provided_signature` tidak cocok dengan:
    - HMAC raw payload
    - request-style HMAC `method + path + appId + timestamp + sha256(body)`
    - beberapa variasi umum canonical JSON dan format request signature

## Status Hipotesis Saat Ini

Terkonfirmasi:

1. Env payment production sudah aktif benar di container `api`
2. Backend menerima raw body callback asli

Masih terbuka:

1. `payment.naeva.id` callback forwarding memakai canonical string signature yang berbeda dari docs publik yang sudah dibaca
2. Event `payment.callback.test` memakai formula signature khusus yang belum terdokumentasi di docs publik

## Kebutuhan Berikutnya

- Dokumentasi tambahan atau contoh konkret dari `payment.naeva.id` untuk pembentukan `X-Payment-Signature` pada callback forwarding
- Alternatif minimal:
  - contoh callback mentah lengkap
  - string-to-sign yang dipakai
  - atau contoh kode verifikasi resmi
