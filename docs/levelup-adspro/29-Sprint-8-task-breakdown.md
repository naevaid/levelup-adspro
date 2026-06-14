# LevelUP adsPRO - Sprint 8 Task Breakdown

## 1. Tujuan Sprint

Sprint 8 berfokus pada `operational readiness and plan enforcement`. Setelah modularisasi awal, QA baseline, dan observability mulai terbentuk, sprint ini mendorong sistem menjadi lebih siap untuk beta terbatas dengan pengawasan operasional dan billing-entitlement yang lebih nyata.

Outcome sprint:

- observability baseline aktif
- alert operasional awal tersedia
- entitlement checks mulai konsisten
- billing flow dasar lebih usable
- internal support lebih siap menangani tenant beta

## 2. Target Deliverables

- request and worker logging terstruktur
- monitoring dashboard internal dasar
- entitlement service v1
- quota enforcement untuk shops dan members
- billing UI/API flow dasar
- incident checklist operasional mulai dipakai

## 3. Daftar Task

## Epic A - Observability Baseline

### Task A1

- Title: Implement structured request logging across API modules
- Type: Backend
- Priority: `P0`
- Output:
  - request ID
  - tenant context di log
  - error log structure seragam

### Task A2

- Title: Implement structured worker logging for ingestion, analytics, and recommendation jobs
- Type: Backend
- Priority: `P0`
- Output:
  - job ID
  - request correlation bila ada
  - success and failure log entries

### Task A3

- Title: Expose basic health and metrics endpoints
- Type: Backend
- Priority: `P1`
- Output:
  - health endpoint
  - queue health summary
  - DB and Redis connectivity checks

## Epic B - Internal Monitoring and Alerts

### Task B1

- Title: Build internal monitoring page or endpoint for API, queue, and ingestion health
- Type: Backend
- Priority: `P1`
- Output:
  - error summary
  - queue backlog summary
  - stale ingestion indicators

### Task B2

- Title: Add operational alert rules for critical failures
- Type: Backend
- Priority: `P1`
- Output:
  - API failure alert
  - ingestion failure spike alert
  - worker stopped alert

### Task B3

- Title: Add support runbook links or references in internal monitoring
- Type: Process
- Priority: `P2`
- Output:
  - simple operator guidance
  - severity mapping

## Epic C - Billing Core Flow

### Task C1

- Title: Implement subscription read model and entitlement summary endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - current plan
  - subscription status
  - features map
  - quota usage summary

### Task C2

- Title: Implement invoice list and current billing state endpoint
- Type: Backend
- Priority: `P1`
- Output:
  - invoice history
  - current billing cycle
  - outstanding state

### Task C3

- Title: Implement billing page shell in frontend
- Type: Frontend
- Priority: `P1`
- Output:
  - current plan card
  - usage panel
  - invoice list

## Epic D - Entitlement Enforcement

### Task D1

- Title: Implement shop quota enforcement in create shop flow
- Type: Backend
- Priority: `P0`
- Output:
  - max shop check
  - over quota denial response

### Task D2

- Title: Implement member quota enforcement in invite flow
- Type: Backend
- Priority: `P0`
- Output:
  - max member check
  - plan limit denial response

### Task D3

- Title: Implement history window enforcement in dashboard queries
- Type: Backend
- Priority: `P1`
- Output:
  - plan-aware date range validation
  - history exceeded error or clamp behavior

### Task D4

- Title: Implement frontend feature gating using entitlement summary
- Type: Frontend
- Priority: `P1`
- Output:
  - module visibility updates
  - upgrade prompts
  - disabled CTA state

## Epic E - Beta Support Readiness

### Task E1

- Title: Add internal tenant billing and quota lookup
- Type: Backend
- Priority: `P1`
- Output:
  - support view for plan
  - usage and over quota status

### Task E2

- Title: Prepare incident checklist for beta support flow
- Type: Process
- Priority: `P1`
- Output:
  - incident severity cheat sheet
  - first response steps
  - escalation path

### Task E3

- Title: Prepare smoke checklist focused on billing, entitlement, and observability
- Type: QA
- Priority: `P1`
- Output:
  - release smoke script
  - monitoring verification steps

## Epic F - Frontend Usability for Limits and States

### Task F1

- Title: Build plan limit warning banners
- Type: Frontend
- Priority: `P1`
- Output:
  - quota nearing limit banner
  - over quota banner

### Task F2

- Title: Build subscription inactive and grace period UI states
- Type: Frontend
- Priority: `P1`
- Output:
  - grace period messaging
  - restricted actions state

### Task F3

- Title: Add data freshness and system status hints in admin-facing screens
- Type: Frontend
- Priority: `P2`
- Output:
  - health summary badge
  - stale data hints

## 4. Acceptance Criteria Sprint

Sprint 8 dianggap selesai jika:

- request dan worker logs memiliki struktur yang konsisten
- health dan monitoring dasar tersedia
- organization dapat membaca entitlement summary
- shop dan member quota mulai ditegakkan
- billing page shell menampilkan plan, usage, dan invoice dasar
- tim internal memiliki panduan incident awal untuk beta

## 5. Dependency

Sprint ini bergantung pada:

- [25-QA-testing-and-release-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/25-QA-testing-and-release-checklist-v1.md)
- [26-Sprint-7-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/26-Sprint-7-task-breakdown.md)
- [27-Observability-metrics-and-incident-response-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/27-Observability-metrics-and-incident-response-v1.md)
- [28-Billing-and-entitlement-detail-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/28-Billing-and-entitlement-detail-v1.md)
- [24-Backend-module-boundaries-and-service-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/24-Backend-module-boundaries-and-service-contract-v1.md)

## 6. Risiko Sprint 8

- alert operasional mudah menjadi noise jika threshold belum matang
- entitlement enforcement bisa memicu bug akses jika summary plan belum konsisten
- billing UI bisa terlihat siap padahal backend checkout masih terbatas
- internal support tools bisa bertambah tanpa prioritas yang jelas

## 7. Catatan Implementasi

- observability baseline harus ringan tetapi benar-benar dipakai
- entitlement checks harus berada di backend lebih dulu sebelum UI
- over-quota handling jangan bersifat destruktif
- billing flow awal boleh sederhana selama status plan dan invoice sudah jelas
