# LevelUP adsPRO - Sprint 5 Task Breakdown

## 1. Tujuan Sprint

Sprint 5 berfokus pada penyatuan `dashboard usability + auth maturity + recommendation workflow`. Jika Sprint 4 membuat data mulai bernilai, maka Sprint 5 membuat produk mulai terasa seperti aplikasi multi-tenant yang benar-benar bisa dipakai tim.

Outcome sprint:

- dashboard utama lebih usable
- organization membership mulai lengkap
- permission model dasar aktif
- recommendation lifecycle mulai interaktif
- market research workspace awal mulai terlihat

## 2. Target Deliverables

- auth dan membership flow dasar lengkap
- tenant switching dasar
- permission guards pada endpoint dan UI
- recommendation action flow
- market research session list dan detail dasar
- dashboard blocks yang lebih stabil untuk multi-role

## 3. Daftar Task

## Epic A - Auth and Membership

### Task A1

- Title: Build user session model and current user endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - session storage
  - `GET /api/v1/me`
  - active organization context

### Task A2

- Title: Build organization invite flow
- Type: Backend
- Priority: `P0`
- Output:
  - create invite
  - invite token validation
  - accept invite

### Task A3

- Title: Build membership management endpoints
- Type: Backend
- Priority: `P0`
- Output:
  - member list
  - role update
  - member remove atau suspend

### Task A4

- Title: Add audit log for membership changes
- Type: Backend
- Priority: `P1`
- Output:
  - audit entries untuk invite, accept, role change, remove

## Epic B - Permission Guards

### Task B1

- Title: Implement organization-bound authorization middleware
- Type: Backend
- Priority: `P0`
- Output:
  - active organization validation
  - tenant ownership validation

### Task B2

- Title: Implement role-based permission guard
- Type: Backend
- Priority: `P0`
- Output:
  - owner guard
  - manager guard
  - staff guard

### Task B3

- Title: Add resource ownership checks for shops and recommendations
- Type: Backend
- Priority: `P0`
- Output:
  - shop access guard
  - recommendation access guard
  - market research access guard

### Task B4

- Title: Add permission-aware navigation payload
- Type: Backend
- Priority: `P1`
- Output:
  - permission flags untuk frontend
  - allowed menu summary

## Epic C - Frontend Auth and Tenant UX

### Task C1

- Title: Build login page and session bootstrap
- Type: Frontend
- Priority: `P0`
- Output:
  - login form
  - auth bootstrap
  - redirect flow

### Task C2

- Title: Build organization switcher in top bar
- Type: Frontend
- Priority: `P1`
- Output:
  - organization switch UI
  - active tenant refresh flow

### Task C3

- Title: Build team management page shell
- Type: Frontend
- Priority: `P1`
- Output:
  - member list
  - role badge
  - invite CTA

### Task C4

- Title: Add permission-based sidebar visibility
- Type: Frontend
- Priority: `P0`
- Output:
  - menu visibility by role
  - fallback page untuk access denied

## Epic D - Recommendation Workflow

### Task D1

- Title: Build recommendation detail endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - recommendation evidence
  - metrics snapshot
  - reason codes

### Task D2

- Title: Build recommendation action endpoints
- Type: Backend
- Priority: `P0`
- Output:
  - acknowledge
  - dismiss
  - mark as done

### Task D3

- Title: Build recommendation feedback capture
- Type: Backend
- Priority: `P1`
- Output:
  - accepted
  - rejected
  - snoozed
  - optional reason

### Task D4

- Title: Build recommendation detail drawer or page
- Type: Frontend
- Priority: `P1`
- Output:
  - detail view
  - evidence panel
  - action buttons

## Epic E - Dashboard Usability

### Task E1

- Title: Build overview cards using dashboard data contract
- Type: Frontend
- Priority: `P0`
- Output:
  - KPI cards
  - growth indicators
  - empty state

### Task E2

- Title: Build freshness widget
- Type: Frontend
- Priority: `P1`
- Output:
  - last sync info
  - freshness badge
  - stale warning

### Task E3

- Title: Build top and worst campaign widgets
- Type: Frontend
- Priority: `P0`
- Output:
  - ranking cards
  - reason tags
  - data quality badge

### Task E4

- Title: Build top and worst product widgets
- Type: Frontend
- Priority: `P0`
- Output:
  - product ranking cards
  - metric snapshot
  - estimated badge bila perlu

## Epic F - Market Research Workspace v1

### Task F1

- Title: Build market research session list endpoint
- Type: Backend
- Priority: `P1`
- Output:
  - keyword session list
  - saved flag
  - summary fields

### Task F2

- Title: Build market research session detail endpoint
- Type: Backend
- Priority: `P1`
- Output:
  - keyword metadata
  - result summary
  - repeated shop hints

### Task F3

- Title: Build market research page shell
- Type: Frontend
- Priority: `P1`
- Output:
  - session list
  - session detail panel
  - empty state

## Epic G - Extension and Session Security

### Task G1

- Title: Build extension session registry and heartbeat validation
- Type: Backend
- Priority: `P1`
- Output:
  - extension session storage
  - stale session detection

### Task G2

- Title: Add extension session status in dashboard or internal tools
- Type: Backend
- Priority: `P1`
- Output:
  - active session count
  - last heartbeat

## 4. Acceptance Criteria Sprint

Sprint 5 dianggap selesai jika:

- user dapat login dan mendapatkan tenant context aktif
- owner dapat mengundang member
- manager dan staff memiliki batas akses yang benar
- sidebar dan halaman menyesuaikan permission
- recommendation dapat dibuka dan diberi aksi
- dashboard overview menampilkan widget utama yang usable
- market research session dasar dapat dilihat di aplikasi

## 5. Dependency

Sprint ini bergantung pada:

- [17-Sprint-4-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/17-Sprint-4-task-breakdown.md)
- [18-Dashboard-data-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/18-Dashboard-data-contract-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)
- [13-UI-information-architecture-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/13-UI-information-architecture-v1.md)
- [16-AI-recommendation-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/16-AI-recommendation-spec-v1.md)

## 6. Risiko Sprint 5

- permission matrix bisa cepat rumit jika role terlalu banyak sejak awal
- dashboard bisa terasa berat jika semua widget dikejar bersamaan
- recommendation action flow berisiko membingungkan jika status lifecycle belum konsisten
- market research UI bisa bertabrakan dengan analytics navigation jika hierarchy belum disiplin

## 7. Catatan Implementasi

- prioritaskan role `owner`, `manager`, dan `staff` dulu
- `agency_admin` bisa disiapkan di data model tetapi belum harus aktif penuh di UI
- untuk frontend, dahulukan shell yang usable sebelum detail visual yang kompleks
- dashboard harus menampilkan `data_quality` dan `last_synced_at` sejak awal
- permission denial perlu punya UX yang jelas, bukan hanya error generik
