# Worker App

Worker process `LevelUP adsPRO` berbasis `NestJS`.

## Menjalankan Lokal

Dari root repo:

```bash
npm run dev:worker
```

Atau dari folder ini:

```bash
npm run start:dev
```

Worker berjalan sebagai process non-HTTP dan menulis status bootstrap ke log.

## Environment

Salin template berikut sebelum development lokal:

```bash
copy .env.example .env
```

Variable awal yang sudah divalidasi melalui `ConfigModule`:

- `DATABASE_URL`
- `REDIS_URL`
- `MINIO_*`
- `WORKER_QUEUE_NAME`

## Catatan Sprint 0

- worker masih placeholder
- bootstrap memakai `createApplicationContext`
- env validation awal sudah aktif untuk mendukung wiring queue di sprint berikutnya
- BullMQ runner dasar sudah aktif dengan mode aman saat Redis belum tersedia
