# Shared VPS Safe Deploy SOP

Dokumen ini adalah SOP deploy aman untuk `levelup-adspro` jika aplikasi berjalan di VPS bersama yang juga dipakai project lain dan service host seperti MySQL dipakai lintas aplikasi.

Dokumen ini melengkapi [`docs/DEPLOYMEN.md`](file:///d:/levelup-adspro/docs/DEPLOYMEN.md). Untuk VPS bersama, dokumen ini yang harus dijadikan acuan utama.

## Tujuan

- Menjaga `git status` production tetap bersih.
- Menghindari build berat langsung di VPS bersama.
- Mencegah service host lintas project seperti `mysql.service` mati karena tekanan memori.
- Membatasi perubahan hanya ke service `levelup-adspro` yang memang perlu disentuh.

## Prinsip Utama

- Jangan edit source langsung di VPS production.
- Jangan simpan backup deploy di dalam root repo production.
- Jangan jalankan `docker compose up -d --build` penuh di VPS bersama kecuali benar-benar darurat dan sudah dicek kapasitas memori.
- Build image/artifact di lokal atau CI, lalu VPS hanya menerima hasil final.
- Jika harus menyentuh VPS, lakukan deploy sempit: hanya file, container, dan migration yang memang relevan.

## Struktur Yang Disarankan Di VPS

- Repo aktif: `/opt/levelup-adspro`
- Backup luar repo: `/opt/backups/levelup-adspro`
- File rahasia/runtime tetap terpisah dari git:
  - `.env.production`
  - upload/storage
  - logs
  - cache

## Pre-Deploy Checklist

Jalankan ini sebelum deploy:

```bash
ssh vps
cd /opt/levelup-adspro
git status --short
free -h
systemctl status mysql --no-pager
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Pastikan:

- `git status --short` kosong.
- memori masih aman dan tidak kritis.
- `mysql.service` aktif jika dipakai project lain di host.
- tidak ada proses build besar lain yang sedang berjalan.

## Pola Deploy Yang Aman

### Opsi A: Paling aman

- Build di lokal/CI.
- Push commit ke `main`.
- VPS hanya `git fetch` dan sinkron ke commit resmi.
- Restart hanya service yang berubah.

Contoh alur:

```bash
ssh vps
cd /opt/levelup-adspro
git fetch origin main
git reset --hard origin/main
```

Lalu jalankan langkah yang memang dibutuhkan saja:

- `api` jika ada perubahan backend
- `web` jika ada perubahan frontend
- migration jika ada schema baru

### Opsi B: Jika harus upload manual

- Backup file lama ke `/opt/backups/levelup-adspro/<timestamp>/`
- Upload hanya file yang berubah
- Jangan buat `.bak` atau `.deploy-backups` di root repo
- Rebuild/restart hanya service target

## Larangan Di VPS Bersama

Hindari langkah berikut di jam operasional atau tanpa pengecekan resource:

```bash
FORCE_DEPLOY=1 bash infra/vps/deploy.sh
docker compose -f docker-compose.vps.yml up -d --build
```

Alasannya:

- build image dapat memakan RAM besar
- kernel bisa melakukan `oom-kill`
- service host seperti MySQL lintas project bisa ikut mati

## Backup Policy

- Simpan backup deploy di luar repo:
  - `/opt/backups/levelup-adspro/<timestamp>/`
- Untuk backup source cepat, simpan:
  - file yang akan diganti
  - patch diff
  - nama commit asal dan target
- Jika perlu menyelamatkan state dirty sebelum sinkronisasi, gunakan `git stash` bernama lalu catat namanya di log deploy.

## Post-Deploy Checklist

Setelah deploy, jalankan:

```bash
cd /opt/levelup-adspro
git status --short
free -h
systemctl status mysql --no-pager
curl -I https://adspro.naeva.id/
curl -I https://adspro.naeva.id/login
curl -I https://adspro.naeva.id/api/v1/me
```

Interpretasi cepat:

- `git status --short` harus kosong
- `mysql.service` harus tetap `active (running)`
- `/` dan `/login` harus `200`
- `/api/v1/me` tanpa token boleh `401`

Jika perlu, cek project lain yang berbagi host:

```bash
curl -I https://mc.naeva.id/
curl -I https://connect.naeva.id/
curl -I https://payment.naeva.id/
```

## Incident Recovery Ringkas

Jika setelah deploy ada indikasi project lain gagal:

1. hentikan aktivitas build/deploy tambahan
2. cek `free -h`
3. cek `journalctl -k --since "15 min ago"`
4. cek `systemctl status mysql --no-pager`
5. pulihkan service host lebih dulu sebelum lanjut deploy aplikasi

## Aturan Operasional

- Production VPS bukan workspace development.
- Semua perubahan source harus masuk repo resmi lebih dulu.
- Working tree production harus kembali bersih setelah deploy.
- Backup fisik boleh ada, tetapi harus di luar root repo.
