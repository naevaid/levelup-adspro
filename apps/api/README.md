# API App

Backend `LevelUP adsPRO` berbasis `NestJS`.

## Menjalankan Lokal

Dari root repo:

```bash
npm run dev:api
```

Atau dari folder ini:

```bash
npm run start:dev
```

API berjalan di `http://localhost:3001`.

## Endpoint Bootstrap

- `GET /health`

Response awal berisi status service, environment, dan port aktif.

## Environment

Salin template berikut sebelum development lokal:

```bash
copy .env.example .env
```

Variable awal yang sudah divalidasi melalui `ConfigModule`:

- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `MINIO_*`
- `JWT_SECRET`

## Catatan Sprint 0

- endpoint masih minimal
- config module global sudah aktif
- env validation awal sudah dipasang untuk bootstrap lokal
