# LevelUP adsPRO - Frontend Component and Wireframe Spec v1

## 1. Tujuan

Dokumen ini mendefinisikan spesifikasi awal komponen frontend dan wireframe tingkat tinggi untuk `LevelUP adsPRO` agar implementasi UI dapat berjalan konsisten, modular, dan selaras dengan data contract serta permission model yang sudah disusun.

Fokus v1:

- app shell
- komponen shared
- wireframe halaman inti
- state UI utama
- hubungan antara komponen, role, dan data contract

## 2. Prinsip Desain Frontend

- bangun komponen reusable lebih dulu, bukan halaman yang saling copy
- semua halaman tenant-bound harus sadar `organization context`
- state `loading`, `empty`, `error`, dan `access denied` harus eksplisit
- angka sensitif harus menampilkan `data_quality`
- wireframe mendahulukan kejelasan insight, bukan dekorasi visual

## 3. Arsitektur Komponen

Komponen dibagi menjadi empat lapisan:

### App Shell

- layout utama
- sidebar
- top bar
- page container

### Shared UI

- buttons
- inputs
- badges
- cards
- tables
- tabs
- drawers
- modals

### Domain Components

- dashboard cards
- recommendation cards
- shop connection panels
- market research result blocks

### Page Assemblies

- Dashboard page
- Shops page
- Market Research page
- Recommendations page
- Team page

## 4. App Shell Components

### 4.1 `AppLayout`

Tanggung jawab:

- membungkus seluruh halaman private app
- menyusun `Sidebar`, `TopBar`, dan `PageContent`

Props utama:

- `user`
- `activeOrganization`
- `navigationItems`
- `children`

### 4.2 `Sidebar`

Tanggung jawab:

- menampilkan menu berdasarkan permission
- menunjukkan menu aktif
- menampilkan badge unread alert bila perlu

State:

- expanded
- collapsed
- mobile open

### 4.3 `TopBar`

Tanggung jawab:

- organization switcher
- shop filter
- date range picker
- freshness indicator
- alert entry point
- user menu

### 4.4 `PageHeader`

Tanggung jawab:

- judul halaman
- subjudul singkat
- actions utama
- filter ringkas jika relevan

## 5. Shared UI Components

### 5.1 `StatCard`

Dipakai untuk KPI seperti:

- revenue
- ad spend
- profit
- ROAS

Field UI:

- label
- formatted value
- growth label
- direction icon
- `data_quality` badge

### 5.2 `DataQualityBadge`

Varian:

- `final`
- `estimated`
- `partial_sync`
- `insufficient_data`

### 5.3 `FreshnessBadge`

Varian:

- `fresh`
- `delayed`
- `stale`
- `never_synced`

### 5.4 `EmptyStatePanel`

Field:

- title
- description
- illustration area
- CTA primary
- CTA secondary

### 5.5 `ErrorStatePanel`

Field:

- title
- description
- retry action

### 5.6 `AccessDeniedPanel`

Dipakai saat route atau widget tidak boleh diakses oleh role aktif.

### 5.7 `FilterBar`

Komponen filter umum untuk:

- shop selector
- marketplace selector
- date range
- severity
- entity type

### 5.8 `EntityTable`

Tabel generik untuk:

- campaign list
- product list
- team list
- market research sessions

Fitur awal:

- sortable columns
- loading skeleton
- empty state inline

### 5.9 `RightDrawer`

Dipakai untuk:

- recommendation detail
- shop detail ringkas
- member detail ringkas

## 6. Domain Components

### 6.1 Dashboard Components

- `OverviewSummaryGrid`
- `TrendChartPanel`
- `TopCampaignList`
- `WorstCampaignList`
- `TopProductList`
- `RecommendationSummaryPanel`
- `FreshnessPanel`

### 6.2 Shop Components

- `ShopCard`
- `ShopConnectionStatus`
- `ShopSyncHistoryPanel`
- `ShopEmptyState`

### 6.3 Recommendation Components

- `RecommendationCard`
- `RecommendationList`
- `RecommendationDetailDrawer`
- `ReasonCodeTagGroup`
- `RecommendationActionBar`

### 6.4 Market Research Components

- `ResearchSessionList`
- `ResearchSessionCard`
- `ResearchResultTable`
- `KeywordSummaryCard`
- `RepeatedShopHintPanel`

### 6.5 Team and Subscription Components

- `MemberList`
- `InviteMemberModal`
- `RoleBadge`
- `PlanCard`
- `QuotaUsagePanel`

## 7. Page Wireframe - Dashboard

Tujuan:

- menampilkan ringkasan performa toko dan insight prioritas dalam satu layar

Wireframe blok:

```text
+-----------------------------------------------------------+
| TopBar                                                    |
+-----------------------------------------------------------+
| PageHeader: Dashboard                     [Date] [Shop]   |
+-----------------------------------------------------------+
| KPI1 | KPI2 | KPI3 | KPI4                                |
+-----------------------------------------------------------+
| Revenue Trend / Spend Trend / ROAS Trend                 |
+-----------------------------------+-----------------------+
| Top Campaigns                     | Recommendation Panel  |
+-----------------------------------+-----------------------+
| Top Products                      | Freshness Panel       |
+-----------------------------------------------------------+
```

Komponen utama:

- `OverviewSummaryGrid`
- `TrendChartPanel`
- `TopCampaignList`
- `RecommendationSummaryPanel`
- `FreshnessPanel`

## 8. Page Wireframe - Shops

Wireframe blok:

```text
+-----------------------------------------------------------+
| TopBar                                                    |
+-----------------------------------------------------------+
| PageHeader: Shops                          [Add Shop]     |
+-----------------------------------------------------------+
| FilterBar                                                  |
+-----------------------------------------------------------+
| Shop Card Grid / Shop Table                               |
+-----------------------------------------------------------+
| Empty state bila belum ada shop                           |
+-----------------------------------------------------------+
```

Detail page atau drawer:

- metadata shop
- connection status
- last sync
- sync error terakhir

## 9. Page Wireframe - Market Research

Wireframe blok:

```text
+-----------------------------------------------------------+
| TopBar                                                    |
+-----------------------------------------------------------+
| PageHeader: Market Research                               |
+-----------------------------------------------------------+
| Session List              | Session Summary               |
|                           | Keyword                       |
|                           | Price Range                   |
|                           | Repeated Shops                |
|                           | Result Table                  |
+-----------------------------------------------------------+
```

Komponen utama:

- `ResearchSessionList`
- `KeywordSummaryCard`
- `ResearchResultTable`
- `EmptyStatePanel`

## 10. Page Wireframe - Recommendations

Wireframe blok:

```text
+-----------------------------------------------------------+
| TopBar                                                    |
+-----------------------------------------------------------+
| PageHeader: Recommendations                               |
+-----------------------------------------------------------+
| FilterBar                                                  |
+-----------------------------------------------------------+
| Recommendation List                                       |
| [Card] [Card] [Card]                                      |
+-----------------------------------------------------------+
| RightDrawer -> Recommendation Detail                      |
+-----------------------------------------------------------+
```

Komponen utama:

- `RecommendationList`
- `RecommendationCard`
- `RecommendationDetailDrawer`
- `RecommendationActionBar`

## 11. Page Wireframe - Team

Wireframe blok:

```text
+-----------------------------------------------------------+
| TopBar                                                    |
+-----------------------------------------------------------+
| PageHeader: Team                           [Invite]       |
+-----------------------------------------------------------+
| Member Table                                              |
+-----------------------------------------------------------+
| Invite Modal                                              |
+-----------------------------------------------------------+
```

Komponen utama:

- `MemberList`
- `RoleBadge`
- `InviteMemberModal`

## 12. Page Wireframe - Subscription

Wireframe blok:

```text
+-----------------------------------------------------------+
| PageHeader: Subscription                                  |
+-----------------------------------------------------------+
| Current Plan Card                                         |
+-----------------------------------+-----------------------+
| Usage / Limits                     | Invoice List          |
+-----------------------------------+-----------------------+
| Upgrade CTA                                                |
+-----------------------------------------------------------+
```

## 13. State Model per Halaman

Setiap halaman minimal harus mendukung:

- `loading`
- `loaded`
- `empty`
- `error`
- `access_denied`

Halaman analytics tambahan:

- `partial_sync`
- `stale_data`

## 14. Skeleton Loading Rules

Untuk menjaga UX:

- cards memakai skeleton card
- table memakai skeleton rows
- chart memakai placeholder panel
- drawer detail memakai paragraph skeleton

## 15. Responsive Behavior

### Desktop

- sidebar tetap terlihat
- dashboard dapat memakai grid 2-4 kolom

### Tablet

- sidebar collapse
- panels stack dua kolom bila memungkinkan

### Mobile

- fokus awal tidak perlu parity penuh untuk semua modul
- minimum support:
  - login
  - dashboard ringkas
  - recommendation list
  - market research list ringkas

## 16. Permission-aware UI Rules

- menu tersembunyi jika role tidak berhak
- action button disable atau disembunyikan sesuai permission
- route guard tetap wajib walau menu disembunyikan
- owner melihat billing dan settings penuh
- staff tidak melihat CTA sensitif seperti `Change Plan`

## 17. Data-binding Rules

Frontend harus membaca kontrak berikut:

- [18-Dashboard-data-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/18-Dashboard-data-contract-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)

Aturan:

- `data_quality` selalu dirender bila ada
- `last_synced_at` ditampilkan di widget relevan
- `empty_state` dari backend boleh langsung dipakai UI
- `reason_codes` tidak perlu diterjemahkan mentah ke user tanpa mapping label

## 18. Component Prioritization

### Wave 1

- `AppLayout`
- `Sidebar`
- `TopBar`
- `PageHeader`
- `StatCard`
- `EmptyStatePanel`
- `DataQualityBadge`

### Wave 2

- `OverviewSummaryGrid`
- `TopCampaignList`
- `TopProductList`
- `RecommendationCard`
- `RecommendationList`
- `MemberList`

### Wave 3

- `RecommendationDetailDrawer`
- `ResearchSessionList`
- `ResearchResultTable`
- `PlanCard`
- `QuotaUsagePanel`

## 19. Suggested Folder Structure

```text
/components
  /layout
  /shared
  /dashboard
  /shops
  /recommendations
  /market-research
  /team
  /subscription
/features
  /auth
  /organization
  /dashboard
  /shops
  /recommendations
  /market-research
```

## 20. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [13-UI-information-architecture-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/13-UI-information-architecture-v1.md)
- [18-Dashboard-data-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/18-Dashboard-data-contract-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)
- [20-Sprint-5-task-breakdown.md](file:///d:/levelup-adspro/docs/levelup-adspro/20-Sprint-5-task-breakdown.md)

## 21. Open Questions

- apakah dashboard dan market research perlu layout berbeda sejak awal
- apakah recommendation detail lebih cocok drawer atau full page pada desktop
- apakah mobile support penuh perlu dikejar sejak MVP beta pertama
- apakah chart library perlu diputuskan lebih awal agar komponen trend stabil
