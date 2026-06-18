# LevelUP adsPRO - Observability, Metrics, and Incident Response v1

## 1. Tujuan

Dokumen ini mendefinisikan baseline observability, metric operasional, dan incident response awal untuk `LevelUP adsPRO` agar MVP tidak hanya berjalan, tetapi juga dapat dipantau, didiagnosis, dan dipulihkan saat terjadi masalah.

Tujuan utamanya:

- mempercepat deteksi masalah
- mempercepat diagnosis root cause
- mengurangi downtime atau silent failure
- menyediakan sinyal yang cukup untuk support internal dan beta awal

## 2. Prinsip Dasar

- observability harus fokus pada flow kritis lebih dulu
- metric tanpa action plan tidak berguna
- log harus searchable dan punya konteks tenant
- alert harus cukup penting agar tidak menjadi noise
- incident handling harus sederhana, cepat, dan bisa diulang

## 3. Observability Scope MVP

Area prioritas observability:

- auth dan session
- ingestion pipeline
- analytics aggregation
- recommendation generation
- dashboard read model
- market research capture
- billing and entitlement checks

## 4. Tiga Pilar Observability

### Metrics

Dipakai untuk:

- melihat trend
- mendeteksi anomaly
- memicu alert

### Logs

Dipakai untuk:

- investigasi detail request
- melacak error spesifik
- audit teknis

### Traces

Pada MVP awal, tracing penuh belum wajib. Namun request correlation minimal perlu tersedia.

Rekomendasi awal:

- mulai dengan request ID dan job ID correlation
- full distributed tracing bisa menyusul

## 5. Operational Domains yang Dipantau

### App Health

- API availability
- frontend availability
- DB connectivity
- Redis connectivity
- object storage connectivity

### User and Tenant Activity

- login success and failure
- active sessions
- organization switching

### Data Pipeline

- ingestion accepted rate
- ingestion failure rate
- normalization success rate
- aggregation latency

### Recommendation Engine

- generation count
- critical recommendation count
- failure count

### Market Research

- public capture session count
- parse failure rate
- saved research volume

### Billing and Plan Enforcement

- checkout success and failure
- entitlement denial count
- quota breach events

## 6. Metric Categories

### Availability Metrics

Contoh:

- `api_http_success_rate`
- `frontend_page_load_success_rate`
- `health_check_failures_total`

### Latency Metrics

Contoh:

- `dashboard_overview_latency_ms`
- `recommendation_list_latency_ms`
- `ingestion_accept_latency_ms`
- `checkout_request_latency_ms`

### Throughput Metrics

Contoh:

- `ingestion_batches_received_total`
- `recommendations_generated_total`
- `market_research_sessions_total`

### Error Metrics

Contoh:

- `api_5xx_total`
- `ingestion_validation_failures_total`
- `recommendation_generation_failures_total`
- `billing_checkout_failures_total`

### Queue and Worker Metrics

Contoh:

- `queue_jobs_pending`
- `queue_jobs_failed_total`
- `queue_job_runtime_ms`

### Storage Metrics

Contoh:

- `raw_payload_storage_bytes`
- `db_size_growth_bytes`
- `backup_failures_total`

## 7. Golden Signals yang Direkomendasikan

Untuk fase MVP, pantau minimal:

- latency
- traffic
- errors
- saturation

Pemetaan awal:

- latency: response time dashboard, login, ingestion
- traffic: request volume, ingestion batches, recommendation reads
- errors: 5xx, failed jobs, failed checkouts
- saturation: CPU, memory, DB connection pool, queue backlog

## 8. Structured Logging Rules

Semua log penting sebaiknya terstruktur.

Field log minimum:

- `timestamp`
- `level`
- `service`
- `environment`
- `request_id`
- `job_id` bila ada
- `organization_id` bila tenant-bound
- `shop_id` bila relevan
- `user_id` bila relevan
- `event_name`
- `message`

## 9. Log Types

### Request Logs

Untuk:

- auth requests
- dashboard API
- extension API
- internal support API

### Worker Logs

Untuk:

- normalization jobs
- aggregation jobs
- recommendation jobs
- cleanup jobs

### Security Logs

Untuk:

- failed login
- permission denial
- suspicious session behavior

### Billing Logs

Untuk:

- checkout attempts
- webhook callbacks
- entitlement denial

## 10. Correlation Rules

Setiap request dan job harus bisa dihubungkan.

Minimal:

- request menghasilkan `request_id`
- async job membawa `job_id`
- jika request memicu job, `request_id` ikut dicatat di log job

Dengan begitu:

- support dapat menelusuri dari UI action ke job backend
- error pada dashboard dapat dikaitkan ke data pipeline terkait

## 11. Alerting Strategy

Alert dibagi dua:

### Operational Alerts

Untuk tim internal.

Contoh:

- API error rate tinggi
- ingestion failures melonjak
- queue backlog besar
- DB disk hampir penuh

### Product Alerts

Untuk user tenant.

Contoh:

- profit negatif
- ROAS drop
- abnormal spend

Dokumen ini fokus pada `operational alerts`.

## 12. Recommended Operational Alerts

### Critical Alerts

- API availability turun signifikan
- login gagal massal
- ingestion batches gagal massal
- DB tidak bisa diakses
- queue worker berhenti

### High Alerts

- dashboard latency naik tajam
- recommendation generation failure rate tinggi
- checkout flow gagal berulang
- backup gagal

### Medium Alerts

- stale extension sessions naik
- market research parse failures meningkat
- storage growth di atas baseline

## 13. Alert Routing

Fase awal yang realistis:

- in-app internal monitoring dashboard
- email internal
- Telegram atau WhatsApp internal opsional

Prioritas:

- critical alert harus segera terlihat
- medium alert boleh cukup masuk dashboard internal

Implementasi baseline saat ini:

- endpoint internal monitoring summary mengembalikan `alerts`
- setiap alert membawa `severity`, `severityLevel`, `operatorGuidance`, dan `runbookRefs`
- summary juga mengembalikan `severityMapping` dan `operatorGuidance` global untuk membantu operator saat incident review awal

## 14. Incident Severity Levels

### Sev 1

Kriteria:

- sistem inti tidak bisa dipakai
- login gagal luas
- tenant data exposure terindikasi

### Sev 2

Kriteria:

- fungsi penting rusak untuk sebagian tenant
- ingestion atau dashboard kritis terganggu

### Sev 3

Kriteria:

- fitur sekunder rusak
- workaround masih ada

### Sev 4

Kriteria:

- bug minor
- observability warning
- degradasi ringan

## 15. Incident Response Workflow

Langkah sederhana yang disarankan:

1. detect
2. triage
3. contain
4. mitigate
5. recover
6. review

### Detect

- dari alert
- dari monitoring dashboard
- dari laporan internal atau user

### Triage

- cek severity
- cek tenant impact
- cek apakah ongoing atau one-off

### Contain

- hentikan job bermasalah jika perlu
- nonaktifkan feature flag tertentu jika tersedia
- cegah kerusakan meluas

### Mitigate

- deploy hotfix
- rollback
- jalankan reprocess atau cleanup bila aman

### Recover

- verifikasi health
- verifikasi user flow utama
- verifikasi error rate turun

### Review

- catat root cause
- catat timeline
- catat action items

## 16. Incident Roles

Untuk fase awal, peran bisa sederhana:

- `incident owner`: memimpin penanganan
- `backend responder`: cek API, worker, DB
- `frontend responder`: cek app rendering dan route issues
- `product responder`: cek dampak ke user dan prioritas komunikasi

## 17. Runbook Priorities

Runbook awal yang sebaiknya dipersiapkan:

- login failure runbook
- ingestion backlog runbook
- dashboard latency runbook
- recommendation anomaly runbook
- checkout failure runbook
- backup failure runbook

## 18. Minimum Internal Monitoring Dashboard

Dashboard internal disarankan punya blok:

- API health
- queue health
- ingestion status
- stale shop sync count
- recommendation generation summary
- checkout and billing status
- storage growth summary

## 19. Key Business-Support Metrics

Selain metric teknis, pantau juga:

- active organizations
- active shops
- connected shops
- recommendation acceptance rate
- daily ingestion-active tenants
- daily market research-active tenants

Metric ini membantu:

- membedakan bug dari low usage
- mengukur dampak incident pada aktivitas nyata

## 20. SLO dan Target Awal

Untuk fase MVP, target kasar yang realistis:

- login success rate tinggi dan stabil
- dashboard overview latency tetap layak dipakai
- ingestion acceptance tidak sering gagal
- critical incident dipulihkan secepat mungkin

Dokumen ini belum menetapkan angka SLO final, tetapi struktur monitoring harus siap menuju sana.

## 21. Data Retention untuk Observability

Rekomendasi awal:

- application logs umum: 14-30 hari
- audit dan security logs: lebih lama sesuai policy
- aggregated observability metrics: 90-180 hari
- incident postmortem records: 12 bulan atau lebih

## 22. Post-Incident Review Template

Field minimum:

- incident title
- severity
- start time
- detected by
- impacted features
- impacted tenant scope
- root cause
- mitigation steps
- recovery time
- follow-up actions

## 23. Failure Scenarios yang Harus Dipantau

- silent ingestion success response tetapi worker gagal memproses
- dashboard tampil kosong padahal data ada
- recommendation melonjak karena threshold bug
- entitlement check salah sehingga fitur berbayar bocor atau tertutup
- cleanup job menghapus data lebih cepat dari seharusnya

## 24. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [15-Data-retention-and-storage-policy-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/15-Data-retention-and-storage-policy-v1.md)
- [24-Backend-module-boundaries-and-service-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/24-Backend-module-boundaries-and-service-contract-v1.md)
- [25-QA-testing-and-release-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/25-QA-testing-and-release-checklist-v1.md)
- [26-Sprint-7-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/26-Sprint-7-task-breakdown.md)

## 25. Open Questions

- apakah observability stack awal cukup memakai logs plus metrics dasar tanpa tracing penuh
- apakah internal alert routing perlu langsung ke Telegram atau cukup dashboard internal dulu
- apakah incident postmortem perlu format ringan atau lebih formal sejak beta awal
- apakah biaya metric retention akan signifikan jika market research volume cepat tumbuh
