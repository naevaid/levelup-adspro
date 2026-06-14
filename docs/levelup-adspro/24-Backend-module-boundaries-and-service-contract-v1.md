# LevelUP adsPRO - Backend Module Boundaries and Service Contract v1

## 1. Tujuan

Dokumen ini mendefinisikan batas modul backend dan service contract awal untuk `LevelUP adsPRO` agar arsitektur `modular monolith` tetap disiplin saat implementasi mulai berjalan.

Tujuan utamanya:

- mencegah coupling antar domain terlalu cepat
- memperjelas tanggung jawab tiap modul
- membantu pembagian task backend per sprint
- menjaga agar API layer, domain logic, dan worker tetap konsisten

## 2. Prinsip Modular Monolith

- setiap modul memiliki tanggung jawab domain yang jelas
- modul lain tidak boleh mengakses tabel internal secara liar tanpa contract
- komunikasi antar modul sebaiknya melalui service interface, bukan query langsung
- API controller harus tipis dan mendorong logika ke application service
- job worker mengikuti contract modul yang sama seperti request sync biasa

## 3. Layering yang Disarankan

Setiap modul disarankan memiliki lapisan berikut:

- `controller` atau `transport`
- `application service`
- `domain logic`
- `repository`
- `dto` atau `contract`

Struktur sederhana:

```text
/modules
  /shops
    /controllers
    /services
    /domain
    /repositories
    /contracts
```

## 4. Daftar Modul Inti

Modul awal yang disarankan:

- `auth`
- `organizations`
- `memberships`
- `subscriptions`
- `billing`
- `shops`
- `marketplace-connections`
- `extension-sessions`
- `ingestion`
- `raw-data`
- `analytics`
- `profit`
- `recommendations`
- `alerts`
- `market-research`
- `audit-logs`
- `internal-support`

## 5. Modul dan Tanggung Jawab

## 5.1 `auth`

Tanggung jawab:

- signup
- login
- logout
- reset password
- session issuance

Bukan tanggung jawab:

- role matrix detail tenant
- billing
- shop authorization detail

Contract utama:

- issue user session
- revoke session
- validate current user

## 5.2 `organizations`

Tanggung jawab:

- create organization
- organization profile
- active organization context
- organization settings dasar

Contract utama:

- get current organization
- update organization profile
- switch active organization

## 5.3 `memberships`

Tanggung jawab:

- invite member
- accept invite
- list members
- change member role
- remove or suspend member

Contract utama:

- assert member access
- list organization members
- mutate role safely

## 5.4 `subscriptions`

Tanggung jawab:

- read active subscription
- enforce plan quota
- check feature entitlement
- lifecycle subscription state

Contract utama:

- get current plan
- check shop limit
- check member limit
- check feature enabled

## 5.5 `billing`

Tanggung jawab:

- checkout request
- invoice listing
- payment provider callback integration
- subscription event recording

Contract utama:

- create checkout session
- mark invoice paid
- record billing event

## 5.6 `shops`

Tanggung jawab:

- create shop
- update shop metadata
- list shops
- shop detail

Contract utama:

- get shop by tenant
- assert shop belongs to organization
- list visible shops

## 5.7 `marketplace-connections`

Tanggung jawab:

- connection status
- sync health
- technical connection metadata
- last success and failure state

Contract utama:

- get connection health
- record sync outcome
- update last sync metadata

## 5.8 `extension-sessions`

Tanggung jawab:

- extension login
- extension session issuance
- heartbeat validation
- stale extension session cleanup

Contract utama:

- create extension session
- validate extension session
- refresh heartbeat

## 5.9 `ingestion`

Tanggung jawab:

- accept payload batch
- validate envelope
- create ingestion batch record
- orchestrate downstream normalization

Contract utama:

- create ingestion batch
- mark batch processing
- mark batch failed or completed

Catatan:

- modul ini tidak boleh memuat semua logika analytics
- fokus pada masuknya data dan orkestrasi awal

## 5.10 `raw-data`

Tanggung jawab:

- simpan metadata object mentah
- referensi object storage
- retention metadata
- purge eligibility

Contract utama:

- save raw payload metadata
- fetch raw payload reference
- mark payload expired

## 5.11 `analytics`

Tanggung jawab:

- normalization hasil capture `owned`
- agregasi campaign, product, dan shop
- formula metric turunan
- overview data source

Contract utama:

- normalize owned payload
- recalculate aggregates
- query overview metrics
- query ranking data

## 5.12 `profit`

Tanggung jawab:

- shop profit settings
- product profit overrides
- profit snapshot calculation
- data quality profit flags

Contract utama:

- save shop profit settings
- save product cost override
- calculate profit snapshot

## 5.13 `recommendations`

Tanggung jawab:

- rule evaluation
- recommendation generation
- recommendation lifecycle
- recommendation feedback

Contract utama:

- generate recommendations
- list active recommendations
- change recommendation status
- record recommendation feedback

## 5.14 `alerts`

Tanggung jawab:

- create alert records
- list alerts
- mark read
- alert dispatch integration untuk fase berikutnya

Contract utama:

- create alert
- list unread alerts
- mark alerts read

## 5.15 `market-research`

Tanggung jawab:

- normalization hasil capture `public`
- keyword research sessions
- keyword research result summary
- saved research lifecycle

Contract utama:

- create research session
- attach research results
- query saved research

## 5.16 `audit-logs`

Tanggung jawab:

- menulis audit trail operasi sensitif
- query audit log untuk support internal

Contract utama:

- write audit entry
- list audit entries by tenant

## 5.17 `internal-support`

Tanggung jawab:

- tenant monitoring
- ingestion monitoring
- sync health lookup
- internal support tools

Contract utama:

- list tenants for support
- list ingestion failures
- inspect shop sync health

## 6. Inter-Module Dependency Rules

Ketergantungan yang disarankan:

- `auth` boleh dipakai oleh semua modul yang butuh current user
- `organizations` dan `memberships` menjadi sumber tenant access
- `shops` dipakai oleh `ingestion`, `analytics`, `profit`, `recommendations`, `alerts`
- `subscriptions` dipakai oleh `shops`, `market-research`, dan fitur gated lainnya
- `ingestion` boleh memanggil `raw-data`, `extension-sessions`, `shops`
- `analytics` dan `market-research` tidak boleh saling mencampur logic normalization
- `recommendations` boleh membaca output `analytics` dan `profit`, bukan raw payload

## 7. Dependency Matrix Ringkas

### Allowed Core Dependencies

- `memberships` -> `organizations`
- `shops` -> `organizations`, `subscriptions`
- `marketplace-connections` -> `shops`
- `extension-sessions` -> `auth`, `organizations`, `shops`
- `ingestion` -> `shops`, `extension-sessions`, `raw-data`
- `analytics` -> `ingestion`, `shops`
- `profit` -> `shops`, `analytics`
- `recommendations` -> `analytics`, `profit`
- `alerts` -> `recommendations`, `shops`
- `market-research` -> `ingestion`, `subscriptions`
- `internal-support` -> banyak modul, tetapi read-oriented

### Avoided Dependencies

- `billing` tidak boleh bergantung ke `analytics`
- `auth` tidak boleh bergantung ke `shops`
- `recommendations` tidak boleh menulis langsung ke `analytics`
- `market-research` tidak boleh menulis ke tabel owned analytics

## 8. Service Contract Style

Setiap service contract sebaiknya:

- eksplisit input dan output-nya
- tenant-aware
- tidak bocor detail storage internal
- mudah dipakai dari controller maupun worker

Contoh naming:

- `CreateShopService`
- `ListOrganizationMembersService`
- `CreateIngestionBatchService`
- `GenerateRecommendationsService`

## 9. Example Service Contracts

### `CreateShopService`

Input:

- `organizationId`
- `actorUserId`
- `marketplaceId`
- `shopName`
- `externalShopId`

Output:

- `shopId`
- `status`

### `CreateIngestionBatchService`

Input:

- `organizationId`
- `shopId`
- `extensionSessionId`
- `captureMode`
- `pageType`
- `payloadSchemaVersion`

Output:

- `batchId`
- `status`

### `GenerateRecommendationsService`

Input:

- `organizationId`
- `shopId`
- `periodStart`
- `periodEnd`

Output:

- `generatedCount`
- `warningCount`
- `criticalCount`

## 10. Controller Rules

- controller hanya validasi request dasar dan mapping response
- controller tidak boleh memegang query domain kompleks
- controller tidak boleh memanggil repository lebih dari satu domain secara langsung
- response contract mengikuti dokumen API dan dashboard contract

## 11. Repository Rules

- repository bertanggung jawab pada persistence dan query domain lokal
- repository tidak boleh berisi orchestration antar modul
- query lintas domain sebaiknya dibungkus query service atau read model service

## 12. Worker and Async Processing Rules

Worker harus memanggil application service yang sama, bukan membuat logic duplikat.

Contoh:

- job `NormalizeOwnedPayloadJob` memanggil service analytics normalization
- job `GenerateRecommendationsJob` memanggil service recommendation generator
- job `CleanupExpiredRawPayloadJob` memanggil service raw-data cleanup

## 13. Read Models vs Transactional Services

Untuk kebutuhan dashboard dan internal admin, boleh ada `read services` khusus.

Contoh:

- `DashboardOverviewReadService`
- `RecommendationListReadService`
- `SupportIngestionMonitorReadService`

Read service:

- fokus pada query gabungan
- tidak mengubah state
- boleh mengakses beberapa repository secara terkendali

## 14. API to Module Mapping

### Public Auth API

- `auth`

### Organization and Member API

- `organizations`
- `memberships`

### Subscription API

- `subscriptions`
- `billing`

### Shop API

- `shops`
- `marketplace-connections`

### Extension API

- `extension-sessions`
- `ingestion`
- `raw-data`

### Dashboard and Analytics API

- `analytics`
- `profit`
- `recommendations`
- `market-research`

### Internal Admin API

- `internal-support`
- `audit-logs`

## 15. Event and Hook Suggestions

Walau masih modular monolith, event internal dapat membantu coupling longgar.

Contoh event:

- `organization.created`
- `member.invited`
- `shop.created`
- `ingestion.batch.accepted`
- `ingestion.batch.completed`
- `analytics.aggregate.updated`
- `recommendation.generated`
- `alert.created`

Fase awal:

- event boleh sederhana dan in-process
- tidak perlu broker terpisah dulu

## 16. Testing Boundary Notes

Setiap modul minimal perlu:

- unit test untuk domain rules
- service test untuk application service utama
- integration test untuk contract lintas modul paling kritis

Prioritas integration test:

- `memberships` + `organizations`
- `shops` + `subscriptions`
- `ingestion` + `extension-sessions`
- `recommendations` + `analytics` + `profit`

## 17. Anti-Patterns yang Harus Dihindari

- service omnibus seperti `AppService` atau `AnalyticsManager` yang menangani semua domain
- controller langsung query banyak tabel lintas domain
- worker membuat logic bisnis sendiri yang berbeda dari request flow
- modul `market-research` dan `analytics` berbagi tabel agregat tanpa batas jelas
- pengecekan tenant dilakukan sebagian saja

## 18. Suggested Folder Map

```text
/src/modules
  /auth
  /organizations
  /memberships
  /subscriptions
  /billing
  /shops
  /marketplace-connections
  /extension-sessions
  /ingestion
  /raw-data
  /analytics
  /profit
  /recommendations
  /alerts
  /market-research
  /audit-logs
  /internal-support
```

## 19. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)
- [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)
- [21-Database-schema-and-migration-plan-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/21-Database-schema-and-migration-plan-v1.md)

## 20. Open Questions

- apakah `billing` perlu dipisah lebih awal dari `subscriptions` atau cukup satu modul dulu
- apakah `internal-support` perlu read-only DB access policy terpisah
- apakah `market-research` dan `keyword-intelligence` perlu dipisah sejak MVP atau tetap satu modul
- apakah event internal perlu disimpan sebagai durable outbox sejak fase awal
