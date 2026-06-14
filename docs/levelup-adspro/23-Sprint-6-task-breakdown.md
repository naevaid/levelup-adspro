# LevelUP adsPRO - Sprint 6 Task Breakdown

## 1. Tujuan Sprint

Sprint 6 berfokus pada `system hardening + implementation alignment` setelah fondasi data, dashboard, auth, dan frontend utama mulai terbentuk. Sprint ini menjadi jembatan dari prototipe fungsional menuju MVP yang lebih stabil dan siap diuji.

Outcome sprint:

- schema dan migration lebih matang
- frontend app shell lebih konsisten
- route guard dan permission UX lebih rapi
- dashboard dan research flow lebih stabil
- observability dan retention job mulai nyata

## 2. Target Deliverables

- migration implementation plan siap eksekusi
- seed data dan baseline local/dev environment lebih rapi
- frontend component system gelombang 1 aktif
- access control UX lengkap
- retention job dan cleanup metadata dasar
- internal monitoring dasar untuk health aplikasi

## 3. Daftar Task

## Epic A - Database and Migration Hardening

### Task A1

- Title: Implement migration wave for identity and tenant core
- Type: Backend
- Priority: `P0`
- Output:
  - `users`
  - `organizations`
  - `memberships`
  - `organization_invites`
  - `user_sessions`

### Task A2

- Title: Implement migration wave for plans, shops, and marketplace connections
- Type: Backend
- Priority: `P0`
- Output:
  - `plans`
  - `subscriptions`
  - `marketplaces`
  - `shops`
  - `marketplace_connections`

### Task A3

- Title: Implement migration wave for extension and ingestion core
- Type: Backend
- Priority: `P0`
- Output:
  - `extension_sessions`
  - `ingestion_batches`
  - `raw_payload_objects`

### Task A4

- Title: Add essential indexes and unique constraints
- Type: Backend
- Priority: `P0`
- Output:
  - tenant indexes
  - business key uniqueness
  - metric date indexes

## Epic B - Seed and Environment Readiness

### Task B1

- Title: Build seeders for plans and marketplaces
- Type: Backend
- Priority: `P0`
- Output:
  - default plans
  - marketplace seed data

### Task B2

- Title: Build local demo organization seeder
- Type: Backend
- Priority: `P1`
- Output:
  - demo owner
  - demo organization
  - demo shop

### Task B3

- Title: Document env variables for app, DB, Redis, object storage, and AI
- Type: Backend
- Priority: `P1`
- Output:
  - `.env` contract draft
  - required vs optional variables

## Epic C - Frontend App Shell Implementation

### Task C1

- Title: Implement `AppLayout`, `Sidebar`, and `TopBar`
- Type: Frontend
- Priority: `P0`
- Output:
  - private app shell
  - role-aware navigation
  - responsive sidebar

### Task C2

- Title: Implement shared state panels and badges
- Type: Frontend
- Priority: `P0`
- Output:
  - `EmptyStatePanel`
  - `ErrorStatePanel`
  - `AccessDeniedPanel`
  - `DataQualityBadge`
  - `FreshnessBadge`

### Task C3

- Title: Implement `PageHeader` and `FilterBar`
- Type: Frontend
- Priority: `P1`
- Output:
  - reusable page header
  - consistent filter patterns

## Epic D - Dashboard and Recommendation UI Hardening

### Task D1

- Title: Integrate overview page with data contract v1
- Type: Frontend
- Priority: `P0`
- Output:
  - KPI cards
  - trend placeholder
  - empty and stale states

### Task D2

- Title: Integrate recommendation list with action states
- Type: Frontend
- Priority: `P0`
- Output:
  - open
  - acknowledged
  - done
  - dismissed

### Task D3

- Title: Build recommendation detail drawer with evidence blocks
- Type: Frontend
- Priority: `P1`
- Output:
  - reason code section
  - metric snapshot section
  - action footer

## Epic E - Permission UX and Route Guard

### Task E1

- Title: Implement frontend route guard by auth and membership state
- Type: Frontend
- Priority: `P0`
- Output:
  - redirect for unauthenticated
  - access denied route
  - inactive membership handling

### Task E2

- Title: Implement permission-aware action rendering
- Type: Frontend
- Priority: `P0`
- Output:
  - hidden or disabled CTA
  - billing action restriction
  - team action restriction

### Task E3

- Title: Implement backend permission middleware across protected endpoints
- Type: Backend
- Priority: `P0`
- Output:
  - auth middleware
  - organization scope middleware
  - role check middleware

## Epic F - Retention and Cleanup Foundation

### Task F1

- Title: Add retention metadata to ingestion and raw payload records
- Type: Backend
- Priority: `P1`
- Output:
  - `retention_until`
  - `purge_status`

### Task F2

- Title: Build raw payload cleanup scheduler draft
- Type: Backend
- Priority: `P1`
- Output:
  - scheduler command
  - expired record selection
  - safe delete flow

### Task F3

- Title: Build stale extension session cleanup job
- Type: Backend
- Priority: `P1`
- Output:
  - stale session detection
  - session status update

## Epic G - Internal Monitoring and Support

### Task G1

- Title: Build ingestion monitoring page or endpoint
- Type: Backend
- Priority: `P1`
- Output:
  - latest batches
  - failure summary
  - status counts

### Task G2

- Title: Build app health summary endpoint
- Type: Backend
- Priority: `P1`
- Output:
  - DB connectivity
  - queue health
  - stale sync count

### Task G3

- Title: Add audit log entries for key protected actions
- Type: Backend
- Priority: `P1`
- Output:
  - membership changes
  - plan change
  - shop change
  - recommendation actions

## 4. Acceptance Criteria Sprint

Sprint 6 dianggap selesai jika:

- migration inti dapat dijalankan dengan urutan yang jelas
- seed data minimum tersedia untuk local development
- app shell private sudah usable
- route guard dan permission UX bekerja
- retention metadata mulai aktif pada data mentah
- monitoring dasar untuk ingestion atau health aplikasi tersedia

## 5. Dependency

Sprint ini bergantung pada:

- [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)
- [22-Frontend-component-and-wireframe-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/22-Frontend-component-and-wireframe-spec-v1.md)
- [18-Dashboard-data-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/18-Dashboard-data-contract-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)
- [20-Sprint-5-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/20-Sprint-5-task-breakdown.md)

## 6. Risiko Sprint 6

- migration bisa terlalu besar jika semua wave dipaksa sekaligus
- komponen frontend bisa tampak rapi tetapi belum konsisten data-binding-nya
- cleanup job berisiko menghapus data terlalu cepat jika retention rules belum disiplin
- internal monitoring mudah terabaikan padahal penting untuk support awal

## 7. Catatan Implementasi

- implementasi migration sebaiknya tetap bertahap, tidak harus seluruh wave dalam satu PR
- prioritaskan komponen frontend wave 1 dulu sebelum halaman kompleks
- access denied dan stale data state perlu diperlakukan sebagai fitur inti, bukan tambahan
- retention cleanup awal cukup aman dan konservatif, jangan agresif
