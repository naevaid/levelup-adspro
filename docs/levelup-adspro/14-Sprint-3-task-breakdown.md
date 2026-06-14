# LevelUP adsPRO - Sprint 3 Task Breakdown

## 1. Tujuan Sprint

Sprint 3 berfokus pada awal integrasi `extension -> ingestion` agar alur data pertama dari marketplace ke backend mulai hidup.

Outcome sprint:

- extension bisa login ke sistem
- page detection dasar tersedia
- ingestion endpoint dasar tersedia
- raw payload pertama bisa diterima backend
- owned data dan public research mulai punya jalur capture terpisah

## 2. Target Deliverables

- extension auth
- extension session
- page detection
- manual sync
- ingestion endpoint
- ingestion validation
- raw batch storage
- raw payload object storage

## 3. Daftar Task

## Epic A - Extension Foundation

### Task A1

- Title: Bootstrap Chrome extension project
- Type: Extension
- Priority: `P0`
- Output:
  - manifest
  - popup shell
  - background script shell
  - content script shell

### Task A2

- Title: Build extension login flow
- Type: Extension
- Priority: `P0`
- Output:
  - login form atau login handoff
  - token storage dasar
  - logout flow

### Task A3

- Title: Build extension session heartbeat
- Type: Extension
- Priority: `P1`
- Output:
  - session registration
  - periodic heartbeat

## Epic B - Page Detection

### Task B1

- Title: Detect Shopee public search page
- Type: Extension
- Priority: `P0`
- Output:
  - page type `shopee_public_search`
  - keyword extraction dasar

### Task B2

- Title: Detect Shopee ads dashboard page
- Type: Extension
- Priority: `P0`
- Output:
  - page type `shopee_ads_dashboard`
  - owned mode detection

### Task B3

- Title: Detect TikTok ads dashboard page
- Type: Extension
- Priority: `P1`
- Output:
  - page type awal untuk TikTok Shop ads

### Task B4

- Title: Build page type debug indicator
- Type: Extension
- Priority: `P1`
- Output:
  - popup menampilkan page type aktif

## Epic C - Payload Builder

### Task C1

- Title: Implement common payload envelope builder
- Type: Extension
- Priority: `P0`
- Output:
  - `capture_mode`
  - `page_type`
  - `marketplace`
  - `payload_schema_version`
  - `captured_at`

### Task C2

- Title: Implement public search payload builder
- Type: Extension
- Priority: `P0`
- Output:
  - keyword
  - result list
  - price range
  - sales hint

### Task C3

- Title: Implement owned metrics payload builder
- Type: Extension
- Priority: `P0`
- Output:
  - metrics array dasar
  - shop identifier dasar

## Epic D - Ingestion API

### Task D1

- Title: Build ingestion batch endpoint
- Type: Backend
- Priority: `P0`
- Output:
  - endpoint accept payload
  - tenant validation
  - basic response contract

### Task D2

- Title: Build payload validator by schema version
- Type: Backend
- Priority: `P0`
- Output:
  - root field validation
  - mode validation
  - page type validation

### Task D3

- Title: Build raw payload storage flow
- Type: Backend
- Priority: `P0`
- Output:
  - ingestion batch record
  - raw payload object record
  - object storage persistence

### Task D4

- Title: Add idempotency handling
- Type: Backend
- Priority: `P1`
- Output:
  - duplicate payload detection
  - duplicate processing prevention

## Epic E - Extension UX

### Task E1

- Title: Add sync now button
- Type: Extension
- Priority: `P0`
- Output:
  - manual sync action
  - loading state
  - success or error state

### Task E2

- Title: Add last sync status in popup
- Type: Extension
- Priority: `P1`
- Output:
  - timestamp last success
  - last error message

## Epic F - Debug and Observability

### Task F1

- Title: Build ingestion log list for internal use
- Type: Backend
- Priority: `P1`
- Output:
  - latest ingestion batches visible
  - status and errors visible

### Task F2

- Title: Add structured logs for extension ingestion
- Type: Backend
- Priority: `P1`
- Output:
  - request log with page_type
  - capture_mode logging
  - validation failure reason

## 4. Acceptance Criteria Sprint

Sprint 3 dianggap selesai jika:

- extension dapat login
- setidaknya satu page Shopee public search bisa dideteksi
- setidaknya satu page Shopee ads dashboard bisa dideteksi
- payload valid bisa diterima backend
- raw batch dan raw payload tersimpan
- user bisa menjalankan manual sync dari extension

## 5. Dependency

Sprint ini bergantung pada:

- auth dan organization dari Sprint 1
- shop registry dan subscription basic dari Sprint 2
- kontrak payload dari [12-Ingestion-payload-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/12-Ingestion-payload-contract-v1.md)
- spesifikasi extension dari [10-Extension-capture-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/10-Extension-capture-spec-v1.md)

## 6. Risiko Sprint 3

- page detection rapuh terhadap perubahan DOM
- data publik dan data owned bisa tertukar jika `capture_mode` tidak disiplin
- payload builder bisa terlalu cepat membesar jika terlalu banyak page type dikejar sekaligus

## 7. Catatan Implementasi

- pada sprint ini belum perlu analytics penuh
- fokus pada jalur data mentah yang stabil
- cukup dukung beberapa page type prioritas dulu
- public search Shopee adalah kandidat paling baik untuk validasi market intelligence awal
