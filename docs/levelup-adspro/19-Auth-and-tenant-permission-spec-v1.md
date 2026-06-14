# LevelUP adsPRO - Auth and Tenant Permission Spec v1

## 1. Tujuan

Dokumen ini mendefinisikan spesifikasi awal untuk authentication, organization membership, dan permission model multi-tenant di `LevelUP adsPRO`.

Tujuan utamanya:

- memastikan data tenant terisolasi
- memastikan role memiliki batas akses yang jelas
- memastikan extension dan dashboard memakai konteks tenant yang aman

## 2. Prinsip Dasar

- semua data bisnis harus terikat ke `organization`
- user dapat menjadi anggota lebih dari satu organization
- permission dievaluasi berdasarkan kombinasi `user + organization + role`
- akses shop dan data analytics tidak boleh hanya bergantung pada `user_id`
- operasi sensitif harus memiliki audit trail
- model permission harus cukup sederhana untuk MVP, tetapi masih bisa berkembang

## 3. Entitas Inti

### User

Merepresentasikan identitas global seseorang di sistem.

Contoh field:

- `id`
- `email`
- `name`
- `password_hash`
- `status`
- `last_login_at`

### Organization

Merepresentasikan tenant utama.

Contoh field:

- `id`
- `name`
- `slug`
- `owner_user_id`
- `status`
- `plan_id`

### Membership

Menghubungkan user dengan organization.

Contoh field:

- `id`
- `organization_id`
- `user_id`
- `role`
- `status`
- `invited_by_user_id`
- `joined_at`

### Shop

Merepresentasikan unit bisnis atau toko di bawah organization.

Contoh field:

- `id`
- `organization_id`
- `marketplace`
- `name`
- `external_shop_id`
- `status`

## 4. Authentication Scope

Sistem membutuhkan tiga konteks auth:

### 4.1 Dashboard User Auth

Dipakai untuk web app utama.

Kebutuhan:

- login email dan password
- session atau token berbasis web
- remember session bila diperlukan

### 4.2 Invitation Acceptance Auth

Dipakai untuk menerima undangan member baru ke organization.

Kebutuhan:

- invite token
- expiry
- validasi email

### 4.3 Extension Auth

Dipakai untuk Chrome extension yang bertindak atas nama user dalam organization tertentu.

Kebutuhan:

- login extension
- issue extension session token
- tenant context yang jelas
- revocation bila session dicabut

## 5. Authentication Flow

### Signup Flow

Urutan awal:

1. user signup
2. sistem membuat user
3. sistem membuat organization pertama
4. sistem membuat membership dengan role `owner`
5. sistem mengembalikan session aktif

### Login Flow

Urutan awal:

1. user login dengan email dan password
2. sistem validasi credential
3. sistem memuat daftar organization user
4. sistem memilih organization aktif terakhir atau organization default
5. sistem mengembalikan session dengan tenant context

### Invite Acceptance Flow

1. owner atau manager mengirim undangan
2. invite token dibuat
3. calon member membuka link invite
4. sistem validasi token dan email
5. membership diaktifkan

## 6. Session Model

Untuk MVP, session model disarankan memisahkan:

- `user session`
- `extension session`

### User Session

Field minimum:

- `session_id`
- `user_id`
- `active_organization_id`
- `issued_at`
- `expires_at`
- `last_seen_at`

### Extension Session

Field minimum:

- `extension_session_id`
- `user_id`
- `organization_id`
- `shop_id` bila relevan
- `device_label`
- `extension_version`
- `issued_at`
- `expires_at`
- `last_heartbeat_at`

## 7. Tenant Context Rules

Setiap request tenant app harus dievaluasi dengan:

- siapa user-nya
- organization aktif apa
- role apa di organization tersebut
- resource shop ini milik organization yang sama atau tidak

Aturan inti:

- user boleh punya banyak organization
- satu session aktif hanya punya satu `active_organization_id`
- switching organization harus eksplisit

## 8. Role Model MVP

Role awal yang disarankan:

- `owner`
- `manager`
- `staff`
- `agency_admin`

Catatan:

- role `admin` internal platform dipisahkan dari tenant role
- `agency_admin` dipakai jika nanti agency mengelola banyak client workspace, tetapi pada MVP awal bisa dipetakan sementara ke permission set `owner-plus`

## 9. Permission Categories

Permission sebaiknya dikelompokkan per domain.

### Organization Permissions

- view organization
- edit organization
- view members
- invite members
- change member role
- remove member

### Shop Permissions

- view shops
- create shop
- edit shop
- view shop connection
- trigger manual sync

### Analytics Permissions

- view dashboard
- view ads analytics
- view product analytics
- view profit analytics
- view market research

### Recommendation Permissions

- view recommendations
- acknowledge recommendations
- dismiss recommendations

### Billing Permissions

- view subscription
- change plan
- view invoices

### Settings Permissions

- edit default settings
- edit notification preferences

## 10. Role Permission Matrix v1

### Owner

Hak akses:

- semua organization permissions
- semua shop permissions
- semua analytics permissions
- semua recommendation permissions
- semua billing permissions
- semua settings permissions

### Manager

Hak akses:

- view organization
- view members
- invite members
- view shops
- create shop
- edit shop
- view shop connection
- trigger manual sync
- semua analytics permissions
- view dan acknowledge recommendations
- tidak wajib dapat `change plan`

### Staff

Hak akses:

- view organization dasar
- view shops
- view dashboard
- view ads analytics
- view product analytics
- view market research
- view recommendations
- baca alerts

Batasan:

- tidak boleh ubah billing
- tidak boleh ubah role member
- tidak boleh edit organization sensitif

### Agency Admin

Hak akses awal:

- setara `owner` di workspace yang dikelolanya
- aturan lintas organization perlu spesifikasi lanjutan di fase berikutnya

## 11. Resource-Level Authorization

Selain role, sistem perlu validasi resource ownership.

Contoh:

- `shop.organization_id` harus sama dengan `active_organization_id`
- `recommendation.organization_id` harus sama dengan tenant aktif
- `market_research_session.organization_id` harus sama dengan tenant aktif

Artinya user dengan role valid tetap tidak boleh melihat resource milik tenant lain.

## 12. Shop-Level Scope

Pada MVP awal, permission cukup di level organization.

Namun sistem perlu siap jika nanti muncul kebutuhan:

- manager A hanya boleh lihat shop tertentu
- staff hanya boleh akses 1-2 shop

Karena itu, desain data sebaiknya memungkinkan tabel tambahan seperti:

- `membership_shop_scopes`

Tetapi implementasinya belum wajib pada MVP awal.

## 13. Extension Authorization Rules

Extension tidak boleh hanya mengirim `organization_id` tanpa validasi.

Minimal aturan:

- extension session harus terkait ke user valid
- extension session harus terkait ke organization aktif saat login extension
- bila `shop_id` dikirim, shop harus milik organization yang sama
- extension session bisa dicabut oleh server
- heartbeat yang kedaluwarsa menandai session tidak aktif

## 14. Invitation and Membership Rules

### Invite Rules

- hanya role dengan permission `invite members` yang boleh mengundang
- invite memiliki expiry, misalnya 3-7 hari
- invite bisa dibatalkan sebelum diterima

### Membership Rules

- membership status minimal: `invited`, `active`, `suspended`, `removed`
- owner utama tidak boleh dihapus tanpa transfer ownership
- perubahan role harus tercatat di audit log

## 15. Ownership Transfer Rules

Karena owner adalah role paling kuat, perlu aturan transfer ownership:

1. owner memilih member aktif lain
2. sistem validasi target adalah member aktif
3. target menjadi owner baru
4. owner lama turun menjadi manager atau role lain
5. event dicatat di audit log

## 16. Internal Admin Separation

Platform internal admin harus dipisahkan dari tenant role.

Contoh internal role:

- `support_admin`
- `ops_admin`
- `super_admin`

Aturan:

- internal role tidak otomatis menjadi member tenant
- akses internal tidak boleh memakai endpoint tenant biasa tanpa audit

## 17. Audit Requirements

Operasi berikut wajib punya audit trail:

- login
- invite member
- accept invite
- role change
- member removal
- ownership transfer
- shop creation
- shop update
- manual sync trigger
- subscription change

Field audit minimum:

- `actor_user_id`
- `organization_id`
- `action`
- `target_type`
- `target_id`
- `before_data` ringkas
- `after_data` ringkas
- `created_at`

## 18. Error and Access Denial Rules

Saat permission gagal, response harus jelas tetapi tidak membocorkan data tenant lain.

Contoh response:

```json
{
  "ok": false,
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Anda tidak memiliki akses untuk aksi ini."
  }
}
```

Contoh `error.code`:

- `UNAUTHENTICATED`
- `INVALID_SESSION`
- `ACCESS_DENIED`
- `MEMBERSHIP_INACTIVE`
- `ORGANIZATION_NOT_FOUND`
- `SHOP_SCOPE_DENIED`

## 19. Security Baseline

Baseline minimum yang disarankan:

- password di-hash dengan standar modern
- reset password token memiliki expiry
- session dapat dicabut
- login attempts sensitif perlu rate limiting
- invite token tidak mudah ditebak
- extension token tidak sama dengan user session cookie

## 20. Recommended Tables

Tabel atau model minimum:

- `users`
- `organizations`
- `memberships`
- `organization_invites`
- `user_sessions`
- `extension_sessions`
- `audit_logs`

Tabel opsional untuk masa depan:

- `membership_shop_scopes`
- `organization_switch_history`

## 21. API Surface Terkait Auth dan Permission

Endpoint terkait yang perlu konsisten dengan dokumen ini:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `GET /api/v1/organizations/current`
- `POST /api/v1/organizations/current/members/invite`
- `PATCH /api/v1/organizations/current/members/{memberId}`
- `DELETE /api/v1/organizations/current/members/{memberId}`
- `POST /api/v1/extension/login`
- `POST /api/v1/extension/session`
- `POST /api/v1/extension/heartbeat`

## 22. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)
- [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)
- [06-API-scope-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/06-API-scope-v1.md)
- [13-UI-information-architecture-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/13-UI-information-architecture-v1.md)

## 23. Open Questions

- apakah MFA perlu disiapkan dari awal atau cukup ditaruh di roadmap fase berikutnya
- apakah staff boleh mengakses profit analytics penuh atau cukup subset tertentu
- apakah `agency_admin` perlu benar-benar aktif pada MVP awal
- apakah organization switching perlu terlihat di top bar sejak versi pertama
