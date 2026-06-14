# LevelUP adsPRO - Sprint 2 Task Breakdown

## 1. Tujuan Sprint

Sprint 2 berfokus pada `tenant completeness` dan `commercial readiness` dasar setelah foundation Sprint 1 selesai.

Outcome sprint:

- organization sudah bisa mengelola member dasar
- plan dan subscription inti sudah tersedia
- marketplace dan shop dasar sudah bisa dibuat
- sistem siap masuk ke tahap extension dan ingestion di sprint berikutnya

Sprint ini masih belum fokus ke analytics. Prioritasnya adalah menyiapkan fondasi tenant, plan, dan shop agar pipeline data nanti punya tempat yang benar.

## 2. Target Deliverables

- invite member flow
- role dasar aktif
- seed plans
- subscription active state
- entitlement check dasar
- marketplace master
- create shop Shopee
- create shop TikTok Shop
- shop detail dan status dasar

## 3. Daftar Task

## Epic A - Membership and Roles

### Task A1

- Title: Buat backend invite member
- Type: Backend
- Priority: `P0`
- Output:
  - endpoint invite member
  - validasi email
  - role assignment saat invite

### Task A2

- Title: Buat flow accept invite
- Type: Backend
- Priority: `P0`
- Output:
  - token invite
  - endpoint accept invite
  - user join ke organization

### Task A3

- Title: Buat UI member management dasar
- Type: Frontend
- Priority: `P0`
- Output:
  - list member
  - invite member form
  - role badge

### Task A4

- Title: Implement role guard owner manager staff
- Type: Backend
- Priority: `P0`
- Output:
  - permission matrix dasar
  - middleware atau guard role

## Epic B - Subscription Core

### Task B1

- Title: Seed master plan
- Type: Database
- Priority: `P0`
- Output:
  - `Free`
  - `Starter`
  - `Pro`
  - `Agency`

### Task B2

- Title: Implement subscription model dasar
- Type: Backend
- Priority: `P0`
- Output:
  - organization punya subscription aktif
  - status dan billing cycle tersimpan

### Task B3

- Title: Build entitlement service
- Type: Backend
- Priority: `P0`
- Output:
  - cek max shops
  - cek max users
  - cek retention
  - cek AI access flag

### Task B4

- Title: Build subscription summary UI
- Type: Frontend
- Priority: `P1`
- Output:
  - current plan
  - status subscription
  - quota shop dan seat

## Epic C - Marketplace and Shop Registry

### Task C1

- Title: Seed marketplaces
- Type: Database
- Priority: `P0`
- Output:
  - Shopee
  - TikTok Shop

### Task C2

- Title: Build shop CRUD backend
- Type: Backend
- Priority: `P0`
- Output:
  - create shop
  - list shop
  - detail shop
  - update metadata shop

### Task C3

- Title: Build create shop UI
- Type: Frontend
- Priority: `P0`
- Output:
  - form tambah shop
  - pilih marketplace
  - simpan external identifier dasar

### Task C4

- Title: Build shop detail page shell
- Type: Frontend
- Priority: `P1`
- Output:
  - informasi shop
  - placeholder sync health
  - placeholder connection status

### Task C5

- Title: Enforce max shop per plan
- Type: Backend
- Priority: `P0`
- Output:
  - create shop ditolak jika limit plan terlampaui
  - error message jelas

## Epic D - Application Navigation and Layout

### Task D1

- Title: Build app navigation for tenant modules
- Type: Frontend
- Priority: `P1`
- Output:
  - menu organization
  - menu shops
  - menu subscription
  - menu dashboard placeholder

### Task D2

- Title: Build organization switch guard
- Type: Backend
- Priority: `P1`
- Output:
  - current organization context tervalidasi
  - semua query tenant-scoped

## Epic E - Tech and Quality

### Task E1

- Title: Add audit log for membership and subscription changes
- Type: Backend
- Priority: `P1`
- Output:
  - audit untuk invite member
  - audit untuk role change
  - audit untuk subscription initialization

### Task E2

- Title: Add tests for auth tenant and subscription rules
- Type: Backend
- Priority: `P1`
- Output:
  - test role guard
  - test shop limit
  - test organization scoping

## 4. Acceptance Criteria Sprint

Sprint 2 dianggap selesai jika:

- owner bisa invite member
- member bisa join ke organization
- role dasar sudah membatasi akses
- shop Shopee dan TikTok Shop bisa dibuat
- plan aktif dapat dibaca
- limit shop per plan benar-benar ditegakkan

## 5. Dependency dari Sprint 1

Sprint 2 bergantung pada hasil Sprint 1:

- auth sudah hidup
- organization creation sudah ada
- app shell sudah tersedia
- database migration dasar sudah siap

## 6. Risiko Sprint 2

- role matrix bisa membesar terlalu cepat
- entitlement service berisiko menyebar ke banyak layer jika tidak dipusatkan
- create shop flow bisa premature jika field yang dibutuhkan belum final

## 7. Catatan Implementasi

- fokus pada `organization`, `plans`, dan `shops`, bukan ingestion dulu
- shop detail cukup sederhana, belum perlu connect flow penuh
- struktur data harus tetap mengikuti [05-ERD-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/05-ERD-v1.md)
- API sprint ini terutama memakai ruang lingkup dari [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)
