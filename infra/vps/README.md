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
- `infra/vps/systemd/levelup-adspro-deploy.service`
- `infra/vps/systemd/levelup-adspro-deploy.timer`
- `docker-compose.prod.yml`
- `docker-compose.vps.yml`
- `.env.production.example`
- `infra/nginx/adspro.naeva.id.conf`

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
COMPOSE_FILE=docker-compose.vps.yml ./infra/vps/deploy.sh
```

## Auto Start Setelah Reboot

Jika ingin stack auto-start:

```bash
sudo cp infra/vps/systemd/levelup-adspro.service /etc/systemd/system/levelup-adspro.service
sudo systemctl daemon-reload
sudo systemctl enable levelup-adspro
sudo systemctl start levelup-adspro
```

Service ini memakai `docker-compose.vps.yml`, sesuai setup host `nginx` yang dipakai sekarang di VPS.

## Auto Deploy Tanpa GitHub Actions

Jika tidak ingin memakai workflow GitHub, gunakan polling ringan dari VPS via `systemd timer`:

```bash
sudo cp infra/vps/systemd/levelup-adspro-deploy.service /etc/systemd/system/levelup-adspro-deploy.service
sudo cp infra/vps/systemd/levelup-adspro-deploy.timer /etc/systemd/system/levelup-adspro-deploy.timer
sudo systemctl daemon-reload
sudo systemctl enable --now levelup-adspro-deploy.timer
```

Perilaku timer:

- cek repo setiap 5 menit
- hanya deploy jika ada commit baru di `origin/main`
- batal deploy jika working tree di VPS tidak bersih, agar perubahan lokal tidak tertimpa

Untuk uji manual:

```bash
sudo systemctl start levelup-adspro-deploy.service
sudo journalctl -u levelup-adspro-deploy.service -n 100 --no-pager
```

## Catatan DNS dan SSL

- pastikan `adspro.naeva.id` mengarah ke IP VPS
- pastikan port `80` dan `443` terbuka

## Jika VPS Sudah Memakai Nginx Host

Jika port `80/443` sudah dipakai `nginx` host:

1. deploy container dengan `docker-compose.vps.yml`
2. aktifkan vhost `infra/nginx/adspro.naeva.id.conf`
3. reload `nginx`
4. jalankan `certbot --nginx -d adspro.naeva.id`
