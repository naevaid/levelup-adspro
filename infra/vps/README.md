# VPS Deploy

Panduan ini dipakai jika `levelup-adspro` akan dibuat sebagai project baru terpisah di VPS.

## Struktur Yang Direkomendasikan

- project directory: `/opt/levelup-adspro`
- project user: `levelup`
- branch deploy default: `main`

## File Penting

- `infra/vps/bootstrap-project.sh`
- `infra/vps/deploy.sh`
- `infra/vps/systemd/levelup-adspro.service`
- `docker-compose.prod.yml`
- `.env.production.example`

## Langkah Ringkas

1. Login ke VPS.
2. Pastikan `docker`, `docker compose`, dan `git` sudah tersedia.
3. Jalankan script bootstrap:

```bash
chmod +x infra/vps/bootstrap-project.sh
./infra/vps/bootstrap-project.sh
```

4. Edit `/opt/levelup-adspro/.env.production`.
5. Jalankan deploy:

```bash
chmod +x infra/vps/deploy.sh
./infra/vps/deploy.sh
```

## Auto Start Setelah Reboot

Jika ingin stack auto-start:

```bash
sudo cp infra/vps/systemd/levelup-adspro.service /etc/systemd/system/levelup-adspro.service
sudo systemctl daemon-reload
sudo systemctl enable levelup-adspro
sudo systemctl start levelup-adspro
```

## Catatan DNS dan SSL

- pastikan `adspro.naeva.id` mengarah ke IP VPS
- pastikan port `80` dan `443` terbuka
- `Caddy` akan mencoba mengeluarkan sertifikat otomatis saat domain sudah resolve dengan benar
