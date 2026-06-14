# Deploy Notes

Catatan awal deployment untuk `LevelUP adsPRO`.

## Target Saat Ini

- subdomain frontend yang sudah disiapkan: `adspro.naeva.id`
- baseline deploy production sekarang memakai `Caddy` sebagai reverse proxy

## Rekomendasi Mapping Awal

- `adspro.naeva.id` -> service `web`
- `/api/*` di `adspro.naeva.id` -> service `api`

Pendekatan ini dipakai di baseline production saat ini agar frontend dan API bisa hidup di satu subdomain lebih dulu.

## Status Saat Ini

- subdomain sudah tersedia
- SSL/TLS belum dikonfigurasi di server aktif
- reverse proxy production sudah disiapkan di repo melalui:
  - `docker-compose.prod.yml`
  - `infra/docker/Caddyfile`
  - `.env.production.example`

## File Deploy Yang Disiapkan

- `docker-compose.prod.yml`
- `infra/docker/Caddyfile`
- `.env.production.example`

## Cara Pakai Di VPS

1. Copy repo ke server.
2. Salin `.env.production.example` menjadi `.env.production`.
3. Isi secret production yang sebenarnya.
4. Pastikan DNS `adspro.naeva.id` mengarah ke IP VPS.
5. Pastikan port `80` dan `443` terbuka.
6. Jalankan:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Jika DNS dan port sudah benar, `Caddy` akan mencoba mengeluarkan sertifikat SSL otomatis.

## Langkah Berikutnya Yang Disarankan

1. Isi secret production di `.env.production`.
2. Validasi DNS `adspro.naeva.id` benar-benar resolve ke VPS.
3. Pastikan firewall dan cloud security group membuka `80` dan `443`.
4. Jalankan deploy production dan cek issuance SSL otomatis dari Caddy.
5. Jika perlu pemisahan domain, pindahkan API ke `api.adspro.naeva.id` pada iterasi berikutnya.
