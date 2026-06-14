# Local Infra

File `docker-compose.yml` di root dipakai untuk menyalakan service lokal Sprint 0:

- Web
- API
- Worker
- PostgreSQL
- Redis
- MinIO

Command yang dipakai dari root repo:

```bash
npm run infra:up
npm run infra:down
npm run infra:logs
```

Port default:

- Web: `3000`
- API: `3001`
- PostgreSQL: `5432`
- Redis: `6379`
- MinIO API: `9000`
- MinIO Console: `9001`

Catatan:

- Compose sekarang sudah memuat service `web`, `api`, dan `worker` selain infra dasar.
- Untuk local development, dev server manual tetap paling cepat dipakai saat coding aktif.
- Untuk containerized bootstrap, jalankan `docker compose up --build`.
