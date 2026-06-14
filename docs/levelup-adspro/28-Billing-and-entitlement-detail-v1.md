# LevelUP adsPRO - Billing and Entitlement Detail v1

## 1. Tujuan

Dokumen ini mendefinisikan detail billing dan entitlement untuk `LevelUP adsPRO` agar model subscription, quota, feature gating, dan perubahan plan dapat diterapkan secara konsisten di backend, frontend, dan support workflow.

Tujuan utamanya:

- memperjelas apa yang dibayar user
- memperjelas fitur apa yang dibuka per plan
- menghindari kebocoran akses atau quota
- mempermudah implementasi billing tanpa kebingungan product rules

## 2. Prinsip Dasar

- subscription melekat ke `organization`, bukan ke user individual
- entitlement harus bisa dicek tanpa logika UI semata
- quota breach harus menghasilkan respons yang jelas
- perubahan plan tidak boleh merusak data historis
- feature gating harus tetap adil antara plan rendah dan plan tinggi

## 3. Billing Scope MVP

Fokus fase awal:

- monthly subscription
- yearly subscription
- active plan tracking
- invoice tracking
- quota enforcement
- feature gating

Belum wajib di fase awal:

- proration kompleks
- coupon system kompleks
- multiple payment provider orchestration sekaligus
- self-serve add-on billing yang rumit

## 4. Entitas Billing Utama

### Plan

Mendefinisikan:

- nama plan
- billing interval yang didukung
- limit dan fitur

### Subscription

Mendefinisikan:

- plan aktif sebuah organization
- status lifecycle
- periode aktif

### Invoice

Mendefinisikan:

- tagihan yang harus atau sudah dibayar
- nominal
- status pembayaran

### Entitlement Snapshot

Mendefinisikan:

- fitur yang boleh digunakan saat ini
- batas quota yang berlaku saat ini

Catatan:

- snapshot bisa dihitung dinamis atau disimpan cache, tetapi contract-nya harus jelas

## 5. Plan Catalog Awal

### `FREE`

Tujuan:

- onboarding
- trial usage ringan

Benefit awal yang disarankan:

- 1 shop
- history 7 hari
- basic dashboard
- market research dasar terbatas
- tanpa AI recommendation penuh

### `STARTER`

Tujuan:

- seller kecil yang mulai serius

Benefit awal:

- 3 shop
- history 90 hari
- AI recommendation dasar
- market research lebih longgar

### `PRO`

Tujuan:

- seller aktif dengan kebutuhan insight lebih dalam

Benefit awal:

- 10 shop
- history panjang
- AI analyst dan recommendation penuh
- team members
- alert channels tambahan

### `AGENCY`

Tujuan:

- agency atau operator multi-client

Benefit awal:

- banyak shop
- banyak user
- white-label atau API access pada fase lanjut

## 6. Entitlement Categories

Entitlement sebaiknya dipisah menjadi dua kelompok:

### Feature Entitlements

Contoh:

- `dashboard_overview`
- `ads_analytics`
- `product_analytics`
- `profit_analytics`
- `recommendations`
- `market_research`
- `team_management`
- `billing_access`
- `api_access`
- `whatsapp_alert`

### Quota Entitlements

Contoh:

- `max_shops`
- `max_members`
- `history_days`
- `max_saved_research_sessions`
- `max_active_extension_sessions`

## 7. Recommended Entitlement Matrix v1

### `FREE`

Feature:

- dashboard overview: yes
- ads analytics dasar: yes
- profit analytics penuh: limited
- recommendations: limited or off
- market research: limited
- team management: off
- billing access: owner only

Quota:

- shops: 1
- members: 1
- history_days: 7

### `STARTER`

Feature:

- recommendations: on
- market research: on
- team management: limited

Quota:

- shops: 3
- members: 3
- history_days: 90

### `PRO`

Feature:

- recommendations: full
- profit analytics: full
- team management: on
- advanced alerts: on

Quota:

- shops: 10
- members: 10 atau sesuai positioning
- history_days: extended

### `AGENCY`

Feature:

- team management: full
- advanced alerts: on
- API access: optional on
- white-label: future gated

Quota:

- shops: high or contract-based
- members: high or unlimited fair usage
- history_days: extended

## 8. Subscription Status Model

Status minimum yang disarankan:

- `trial`
- `active`
- `past_due`
- `grace_period`
- `canceled`
- `expired`

Aturan umum:

- `active`: semua entitlement plan aktif
- `past_due`: akses tertentu bisa tetap berjalan terbatas sambil menunggu pembayaran
- `grace_period`: data masih ada, upgrade atau bayar ulang masih memungkinkan
- `canceled` atau `expired`: akses write dan fitur premium dibatasi

## 9. Billing Lifecycle

Alur sederhana yang disarankan:

1. organization memilih plan
2. subscription dibuat
3. invoice dibuat
4. payment provider memproses pembayaran
5. invoice menjadi paid
6. subscription menjadi active
7. entitlement aktif mengikuti subscription terbaru

## 10. Checkout Rules

Checkout flow MVP:

- owner memilih plan
- sistem membuat draft invoice
- sistem membuat request ke payment provider
- redirect atau payment link dikembalikan
- callback atau webhook memperbarui status

Catatan:

- manager dan staff tidak boleh mengubah plan kecuali ada kebijakan khusus

## 11. Invoice Rules

Invoice minimum menyimpan:

- invoice number
- organization
- plan
- billing interval
- amount
- currency
- status
- issued_at
- due_at
- paid_at

Status invoice minimum:

- `draft`
- `issued`
- `paid`
- `failed`
- `void`

## 12. Entitlement Evaluation Rules

Entitlement harus dapat dijawab dengan cepat untuk pertanyaan:

- bolehkah tenant menambah shop baru
- bolehkah tenant mengundang member baru
- bolehkah tenant membuka modul tertentu
- bolehkah tenant melihat histori lebih lama dari batas plan

Pola check awal:

1. baca subscription aktif
2. baca plan code
3. hitung atau baca entitlement snapshot
4. bandingkan dengan usage aktual
5. kembalikan `allowed`, `limited`, atau `denied`

## 13. Feature Gating Rules

Feature gating sebaiknya dilakukan di:

- backend service
- API response
- frontend visibility

Urutannya:

- backend adalah sumber kebenaran
- frontend hanya memantulkan hasil entitlement

Contoh:

- endpoint recommendation tetap harus mengecek plan walau menu frontend disembunyikan

## 14. Quota Enforcement Rules

### Shop Limit

Saat create shop:

- cek `max_shops`
- hitung active shops tenant
- jika melebihi, tolak dengan error terstruktur

### Member Limit

Saat invite member:

- cek `max_members`
- hitung active memberships
- jika melebihi, tolak

### History Window

Saat query dashboard:

- jika `date_from` terlalu lama dari batas plan, clamp atau tolak
- response harus memberi tahu alasan pembatasan

## 15. Usage Counting Rules

Usage yang disarankan dihitung:

- active shops
- active members
- saved research sessions
- active extension sessions jika nanti dipakai quota

Aturan:

- suspended atau removed tidak dihitung sebagai active member
- disconnected shop bisa tetap dihitung jika status bisnisnya masih aktif, tergantung policy

## 16. Upgrade Rules

Saat upgrade:

- entitlement baru aktif secepat mungkin setelah payment valid
- data lama tidak perlu dimigrasi besar-besaran
- akses histori tambahan bisa langsung dibuka jika data fisik tersedia

## 17. Downgrade Rules

Saat downgrade:

- data historis tidak langsung dihapus
- akses dibatasi sesuai plan baru
- jika usage melebihi limit baru:
  - tandai tenant `over_quota`
  - blok aksi tambah resource baru
  - jangan langsung hapus resource lama

Contoh:

- tenant punya 5 shop lalu turun ke `STARTER` dengan limit 3
- tenant tetap bisa melihat shop lama
- tenant tidak bisa menambah shop baru sampai usage kembali di bawah limit atau upgrade lagi

## 18. Grace Period Rules

Jika pembayaran gagal atau subscription habis:

- tenant masuk `grace_period`
- fitur read-only inti bisa tetap aktif terbatas
- aksi premium atau write tertentu dapat dibatasi
- market research atau recommendation premium bisa ditutup lebih awal bila diperlukan

## 19. Owner, Manager, Staff Billing Access

### Owner

Boleh:

- lihat plan
- ubah plan
- lihat invoice
- memulai checkout

### Manager

Boleh:

- lihat plan ringkas jika diperlukan
- tidak otomatis boleh ubah plan

### Staff

Boleh:

- umumnya tidak perlu akses billing sensitif

## 20. API and UI Contract Suggestions

Backend sebaiknya menyediakan response entitlement ringkas seperti:

```json
{
  "plan_code": "starter",
  "subscription_status": "active",
  "features": {
    "recommendations": true,
    "market_research": true,
    "team_management": true
  },
  "quotas": {
    "max_shops": 3,
    "used_shops": 2,
    "max_members": 3,
    "used_members": 2,
    "history_days": 90
  }
}
```

## 21. Error Contract for Entitlement Denial

Contoh response:

```json
{
  "ok": false,
  "error": {
    "code": "PLAN_LIMIT_REACHED",
    "message": "Batas shop untuk plan saat ini sudah tercapai."
  }
}
```

Contoh `error.code`:

- `PLAN_LIMIT_REACHED`
- `FEATURE_NOT_AVAILABLE`
- `SUBSCRIPTION_INACTIVE`
- `HISTORY_WINDOW_EXCEEDED`
- `CHECKOUT_NOT_ALLOWED`

## 22. Billing Webhook Notes

Jika payment provider dipakai:

- webhook harus idempotent
- invoice update tidak boleh dobel
- subscription status change harus tercatat di event log
- audit log minimal untuk perubahan status penting

## 23. Support and Internal Tools

Internal support perlu bisa melihat:

- plan aktif tenant
- status subscription
- invoice terakhir
- usage quota saat ini
- over quota status

## 24. Fair Usage Considerations

Untuk plan tinggi, `unlimited` sebaiknya dibaca sebagai:

- sangat longgar
- tetap berada dalam batas penggunaan wajar

Hal ini penting untuk:

- storage raw payload
- market research result volume
- AI usage intensif

## 25. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)
- [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)
- [15-Data-retention-and-storage-policy-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/15-Data-retention-and-storage-policy-v1.md)
- [19-Auth-and-tenant-permission-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/19-Auth-and-tenant-permission-spec-v1.md)

## 26. Open Questions

- apakah `FREE` perlu benar-benar tanpa recommendation, atau tetap diberi preview terbatas
- apakah `PRO` dan `AGENCY` perlu beda pada API access sejak fase awal
- apakah proration perlu disiapkan lebih cepat jika upgrade mid-cycle sering terjadi
- apakah market research saved session perlu masuk quota plan secara eksplisit
