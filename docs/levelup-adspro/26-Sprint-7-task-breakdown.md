# LevelUP adsPRO - Sprint 7 Task Breakdown

## 1. Tujuan Sprint

Sprint 7 berfokus pada `implementation discipline and beta-readiness`. Setelah fondasi schema, app shell, permission, dan monitoring awal mulai siap, sprint ini mendorong implementasi ke struktur backend modular yang lebih rapi dan quality gate yang lebih nyata.

Outcome sprint:

- modul backend inti mulai terpisah rapi
- contract lintas service lebih jelas
- QA checklist mulai diterapkan ke flow utama
- release readiness meningkat
- beta internal menjadi lebih realistis

## 2. Target Deliverables

- struktur modul backend wave 1
- service contract inti dipakai pada flow utama
- test automation prioritas tinggi mulai aktif
- internal support endpoint dasar usable
- release checklist dapat dijalankan end-to-end

## 3. Daftar Task

## Epic A - Backend Modularization Wave 1

### Task A1

- Title: Implement module skeleton for auth, organizations, memberships, and shops
- Type: Backend
- Priority: `P0`
- Output:
  - folder structure modul
  - controllers
  - services
  - repositories
  - contracts

### Task A2

- Title: Implement module skeleton for extension-sessions, ingestion, and raw-data
- Type: Backend
- Priority: `P0`
- Output:
  - ingestion boundary
  - raw payload metadata boundary
  - extension session boundary

### Task A3

- Title: Implement module skeleton for analytics, profit, and recommendations
- Type: Backend
- Priority: `P0`
- Output:
  - analytics read and write services
  - profit services
  - recommendation services

## Epic B - Service Contract Adoption

### Task B1

- Title: Refactor shop flow to use application services consistently
- Type: Backend
- Priority: `P0`
- Output:
  - create shop service
  - update shop service
  - list shop read service

### Task B2

- Title: Refactor ingestion flow to use batch service and raw-data service
- Type: Backend
- Priority: `P0`
- Output:
  - create ingestion batch service
  - save raw payload metadata service
  - status transition service

### Task B3

- Title: Refactor recommendation flow to use generator and lifecycle services
- Type: Backend
- Priority: `P1`
- Output:
  - generate recommendation service
  - update recommendation status service
  - record feedback service

## Epic C - Testing Automation Wave 1

### Task C1

- Title: Add unit tests for metrics formula and profit flags
- Type: Backend
- Priority: `P0`
- Output:
  - formula tests
  - profit completeness tests

### Task C2

- Title: Add unit tests for recommendation rule evaluator
- Type: Backend
- Priority: `P0`
- Output:
  - pause rule tests
  - scale rule tests
  - insufficient data tests

### Task C3

- Title: Add integration tests for tenant scoping and role checks
- Type: Backend
- Priority: `P0`
- Output:
  - tenant isolation test
  - owner manager staff access tests

### Task C4

- Title: Add frontend tests for route guard and access denied states
- Type: Frontend
- Priority: `P1`
- Output:
  - unauthenticated redirect tests
  - access denied rendering tests

## Epic D - Dashboard and UX Stability

### Task D1

- Title: Harden dashboard read services and empty state handling
- Type: Backend
- Priority: `P1`
- Output:
  - stable overview read model
  - empty state contract consistency

### Task D2

- Title: Harden frontend widgets for loading, empty, stale, and error states
- Type: Frontend
- Priority: `P0`
- Output:
  - dashboard cards state handling
  - recommendation list state handling
  - market research state handling

### Task D3

- Title: Add role-based navigation regression checks
- Type: Frontend
- Priority: `P1`
- Output:
  - owner navigation
  - manager navigation
  - staff navigation

## Epic E - Internal Support and Monitoring

### Task E1

- Title: Build internal ingestion monitoring endpoint from support read service
- Type: Backend
- Priority: `P1`
- Output:
  - latest batches
  - failure summary
  - filter by tenant or shop

### Task E2

- Title: Build internal sync health lookup
- Type: Backend
- Priority: `P1`
- Output:
  - shop sync health read service
  - stale shop detection

### Task E3

- Title: Add audit log coverage for sensitive flows
- Type: Backend
- Priority: `P1`
- Output:
  - member changes
  - plan changes
  - shop changes
  - recommendation actions

## Epic F - Beta Release Preparation

### Task F1

- Title: Execute pre-release checklist on internal environment
- Type: QA
- Priority: `P0`
- Output:
  - checklist result
  - issue list
  - release blockers

### Task F2

- Title: Prepare demo tenant and regression fixtures
- Type: Backend
- Priority: `P1`
- Output:
  - seeded demo org
  - seeded demo shops
  - seeded recommendation data

### Task F3

- Title: Draft internal release notes template
- Type: Process
- Priority: `P1`
- Output:
  - changes summary template
  - migration note template
  - rollback note template

## 4. Acceptance Criteria Sprint

Sprint 7 dianggap selesai jika:

- modul backend wave 1 sudah nyata di code structure
- flow utama tidak lagi terlalu bergantung pada controller-heavy pattern
- automated tests prioritas tinggi mulai berjalan
- dashboard dan route guard lebih stabil pada state utama
- support endpoint dasar tersedia
- pre-release checklist dapat dijalankan untuk internal beta

## 5. Dependency

Sprint ini bergantung pada:

- [23-Sprint-6-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/23-Sprint-6-task-breakdown.md)
- [24-Backend-module-boundaries-and-service-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/24-Backend-module-boundaries-and-service-contract-v1.md)
- [25-QA-testing-and-release-checklist-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/25-QA-testing-and-release-checklist-v1.md)
- [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)
- [22-Frontend-component-and-wireframe-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/22-Frontend-component-and-wireframe-spec-v1.md)

## 6. Risiko Sprint 7

- modularisasi bisa memperlambat delivery bila refactor terlalu agresif
- test automation bisa setengah jalan jika fixture dan environment belum siap
- support tools bisa berkembang menjadi terlalu besar sebelum beta benar-benar dimulai
- release checklist bisa dianggap formalitas jika tidak dipakai pada release nyata

## 7. Catatan Implementasi

- fokus pada modul wave 1 yang paling sering dipakai dulu
- refactor sebaiknya incremental, bukan big bang rewrite
- gunakan QA checklist sebagai alat prioritas, bukan dokumen pasif
- jangan kejar coverage tinggi secara angka; utamakan flow kritis
