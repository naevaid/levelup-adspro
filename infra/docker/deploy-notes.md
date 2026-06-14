# Deploy Notes

Catatan awal deployment untuk `LevelUP adsPRO`.

## Target Saat Ini

- subdomain frontend yang sudah disiapkan: `adspro.naeva.id`

## Rekomendasi Mapping Awal

- `adspro.naeva.id` -> service `web`
- `api.adspro.naeva.id` -> service `api` bila nanti dipisah ke subdomain terpisah

Untuk fase awal, API juga bisa tetap diproxy dari domain utama melalui path `/api` jika itu lebih sederhana saat bootstrap VPS.

## Status Saat Ini

- subdomain sudah tersedia
- SSL/TLS belum dikonfigurasi
- reverse proxy production belum disiapkan di repo ini

## Langkah Berikutnya Yang Disarankan

1. Tambahkan reverse proxy production seperti Nginx, Caddy, atau Traefik.
2. Pasang sertifikat SSL untuk `adspro.naeva.id`.
3. Tentukan apakah API memakai subdomain sendiri atau diproxy dari domain utama.
4. Tambahkan env production terpisah untuk web, api, dan worker.
