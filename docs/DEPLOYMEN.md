# Deployment (VPS)

Dokumen ini menjelaskan cara deploy `levelup-adspro` ke VPS secara manual menggunakan mekanisme yang saat ini dipakai di server: `docker compose` + `nginx` host reverse proxy + `systemd` service/timer untuk auto-poll.

## 1) Gambaran Arsitektur

- Domain publik: `https://adspro.naeva.id`
- `nginx` di host menangani port `80/443` dan meneruskan trafik ke container via loopback:
  - Web: `127.0.0.1:3100` → container `web:3000`
  - API: `127.0.0.1:3101` → container `api:3001`
- `docker compose` yang dipakai di VPS: `docker-compose.vps.yml`
- Script deploy di VPS: `infra/vps/deploy.sh`

## 2) File Penting

- `.env.production` (di VPS, di root project `/opt/levelup-adspro/.env.production`)
  - Jangan commit file ini.
  - Buat dari `.env.production.example` lalu isi value yang benar.
- `infra/nginx/adspro.naeva.id.conf`
  - Contoh konfigurasi nginx yang benar (penting: `proxy_pass` untuk `/api/` tidak memakai trailing slash).
- `infra/vps/systemd/*`
  - Unit `systemd` untuk auto start dan polling deploy.

## 3) Setup Awal (sekali saja)

1. Pastikan repo tersedia di VPS:
   - Lokasi standar: `/opt/levelup-adspro`
   - Branch: `main`
2. Buat `.env.production`:
   - Copy dari `.env.production.example`
   - Isi password/secret sesuai environment.
3. Pastikan `nginx` host sudah punya vhost `adspro.naeva.id`.
4. Pastikan docker & docker compose plugin tersedia di VPS.

## 4) Manual Deploy (disarankan untuk release)

Jalankan di VPS:

```bash
cd /opt/levelup-adspro
FORCE_DEPLOY=1 bash infra/vps/deploy.sh
```

Catatan:
- Script akan:
  1) `git fetch` dan `git pull`
  2) `docker compose up -d --build` (pakai `docker-compose.vps.yml` secara default)
  3) `prisma migrate deploy` + `node prisma/seed.js`
  4) menampilkan status container

## 5) Verifikasi Setelah Deploy

### Cek container

```bash
cd /opt/levelup-adspro
docker compose -p levelup-adspro -f docker-compose.vps.yml --env-file .env.production ps
```

### Cek endpoint cepat

```bash
curl -I https://adspro.naeva.id/
curl -I https://adspro.naeva.id/signup
```

Jika perlu cek API:

```bash
curl -I https://adspro.naeva.id/api/v1/me
```

Catatan:
- Endpoint `me` butuh header `Authorization: Bearer <token>`, jadi `-I` akan wajar mendapatkan `401`.

## 6) Nginx Reverse Proxy (host)

Konfigurasi penting:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3101;
}

location / {
    proxy_pass http://127.0.0.1:3100;
}
```

Kenapa tidak pakai trailing slash di `proxy_pass`?
- Jika memakai `proxy_pass http://127.0.0.1:3101/;`, nginx akan memotong prefix `/api/` sehingga request `/api/v1/...` di upstream menjadi `/v1/...` dan memicu 404.

Reload nginx setelah perubahan:

```bash
nginx -t && systemctl reload nginx
```

## 7) Auto Deploy (Polling) via systemd

Jika auto deploy berbasis polling diaktifkan, VPS akan menjalankan `infra/vps/deploy.sh` secara berkala.

File unit berada di:
- `infra/vps/systemd/levelup-adspro.service`
- `infra/vps/systemd/levelup-adspro-deploy.service`
- `infra/vps/systemd/levelup-adspro-deploy.timer`

Perintah umum:

```bash
systemctl status levelup-adspro.service
systemctl status levelup-adspro-deploy.timer
journalctl -u levelup-adspro-deploy.service -n 200 --no-pager
```

## 8) Troubleshooting

### 502 Bad Gateway
- Cek `nginx` host + upstream:
  - `systemctl status nginx`
  - `curl -I http://127.0.0.1:3100/`
  - `curl -I http://127.0.0.1:3101/api/v1/health` (jika ada)
- Cek container:
  - `docker ps`
  - `docker logs levelup-adspro-web --tail 200`
  - `docker logs levelup-adspro-api --tail 200`

### Deploy gagal karena port 80/443 already in use
- Pastikan deploy VPS memakai `docker-compose.vps.yml`, bukan compose yang menyalakan reverse proxy container.
- Host `nginx` memegang port 80/443.

