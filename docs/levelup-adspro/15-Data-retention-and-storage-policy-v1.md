# LevelUP adsPRO - Data Retention and Storage Policy v1

## 1. Tujuan

Dokumen ini mendefinisikan kebijakan retensi data dan storage policy awal untuk `LevelUP adsPRO`. Tujuannya agar sejak awal sistem memiliki batas yang jelas untuk:

- data apa yang disimpan
- berapa lama data dipertahankan
- kapan data diarsipkan
- kapan data dihapus atau dianonimkan
- bagaimana biaya storage tetap terkendali saat volume data tumbuh

## 2. Prinsip Umum

- simpan data seperlunya, bukan sebanyak mungkin
- pisahkan data operasional, analytics, audit, dan data mentah
- raw payload tidak boleh menjadi sumber baca utama dashboard
- tenant harus memiliki isolasi data yang jelas
- kebijakan retensi harus mempertimbangkan plan subscription
- data publik hasil market research tidak boleh diperlakukan sama dengan data toko milik user
- data yang sudah melewati masa pakai operasional harus diarsipkan atau dihapus

## 3. Tujuan Bisnis dari Retention Policy

Retention policy dibutuhkan untuk menjaga empat hal:

1. biaya object storage dan database tetap sehat
2. dashboard tetap cepat karena tidak selalu membaca data mentah
3. histori penting tetap tersedia untuk analytics dan AI
4. proses delete tenant atau downgrade plan bisa dilakukan dengan terukur

## 4. Klasifikasi Data

### 4.1 Identity and Tenant Data

Contoh:

- users
- organizations
- memberships
- roles
- subscription plans
- active subscriptions

Karakter:

- data inti sistem
- ukurannya kecil
- masa simpannya panjang

### 4.2 Shop and Connection Data

Contoh:

- marketplace connections
- shop registry
- extension sessions
- device registrations

Karakter:

- dibutuhkan untuk operasional aktif
- sebagian bersifat sensitif
- perlu lifecycle yang jelas saat shop diputuskan atau tenant berhenti berlangganan

### 4.3 Raw Ingestion Data

Contoh:

- ingestion batches
- raw payload objects dari extension
- validation result
- page capture metadata

Karakter:

- volume tinggi
- penting untuk debugging dan replay terbatas
- tidak cocok disimpan lama di hot database

### 4.4 Normalized Analytics Data

Contoh:

- campaign daily metrics
- product daily metrics
- shop daily summary
- aggregated public keyword results

Karakter:

- menjadi sumber utama dashboard
- perlu dipertahankan lebih lama dibanding raw payload
- perlu strategi partisi atau archiving saat data tumbuh

### 4.5 Financial and Billing Data

Contoh:

- invoices
- payment transactions
- subscription history
- tax-related billing metadata

Karakter:

- sensitif
- retensinya relatif panjang
- perubahan harus tercatat

### 4.6 AI and Recommendation Data

Contoh:

- recommendation snapshots
- recommendation feedback
- AI explanation output
- chat analyst history

Karakter:

- nilainya tinggi untuk learning product
- ukurannya bisa cepat membesar jika chat history tidak dibatasi

### 4.7 Audit and Security Logs

Contoh:

- login audit
- role change logs
- critical configuration changes
- ingestion error logs

Karakter:

- dibutuhkan untuk investigasi
- retensinya lebih lama dari log teknis biasa

## 5. Storage Tier Model

Policy awal disarankan membagi storage menjadi tiga tier.

### Hot Storage

Dipakai untuk data yang sering dibaca aplikasi:

- relational database utama
- Redis untuk cache dan queue state
- tabel summary harian dan entitas aktif

Contoh data:

- active organizations
- active shops
- latest dashboard summary
- recommendation terbaru

### Warm Storage

Dipakai untuk data yang masih mungkin dibutuhkan, tetapi tidak harus selalu cepat.

Contoh:

- raw payload 30-180 hari terakhir
- historical aggregates
- archived recommendation history

Implementasi awal bisa tetap memakai object storage dan tabel metadata di database.

### Cold Storage

Dipakai untuk data lama yang hanya dibutuhkan untuk compliance, audit, atau restore terbatas.

Contoh:

- backup bulanan
- export histori billing
- arsip audit log lama

Pada fase MVP, cold storage bisa disederhanakan menjadi backup terkompresi terjadwal.

## 6. Retention Matrix Awal

### 6.1 Identity and Tenant Data

- user dan organization aktif: simpan selama tenant aktif
- membership history: simpan 24 bulan setelah perubahan terakhir
- deleted user soft-delete metadata: simpan 90 hari sebelum purge permanen

### 6.2 Shop and Connection Data

- shop registry aktif: simpan selama shop aktif
- disconnected marketplace connection record: simpan 180 hari
- extension session log: simpan 30 hari
- device fingerprint atau session metadata: simpan 30-90 hari sesuai kebutuhan keamanan

### 6.3 Raw Ingestion Data

- ingestion batch metadata: simpan 180 hari
- raw payload object: default 30 hari untuk plan rendah
- raw payload object plan berbayar: default 90 hari
- validation failure payload ringkas: simpan 30 hari
- payload yang masuk ke jalur replay manual: boleh ditahan sampai 180 hari

Catatan:

- raw payload penuh tidak perlu disimpan tanpa batas
- dashboard harus membaca hasil normalisasi, bukan payload mentah

### 6.4 Normalized Analytics Data

- daily metrics: simpan minimal sesuai benefit plan
- plan `FREE`: akses histori 7 hari, penyimpanan backend 30 hari
- plan `STARTER`: akses histori 90 hari, penyimpanan backend 180 hari
- plan `PRO`: akses histori panjang, penyimpanan backend 24 bulan
- plan `AGENCY`: penyimpanan backend 24 bulan atau lebih sesuai kontrak

Catatan:

- akses user dan storage backend tidak harus identik
- sistem boleh menyimpan sedikit lebih lama dari window tampilan untuk keamanan migrasi dan rollback agregasi

### 6.5 Public Market Intelligence Data

- keyword research session metadata: simpan 180 hari
- keyword research result detail: simpan 90 hari default
- aggregated keyword trend summary: simpan 12 bulan
- capture publik yang tidak pernah disimpan user: boleh dihapus lebih cepat, misalnya 14-30 hari

Catatan:

- data publik yang hanya dipakai sebagai transient capture tidak perlu dipertahankan seperti data owned shop
- jika user menandai result sebagai saved research, retensi bisa diperpanjang

### 6.6 Financial and Billing Data

- invoice: simpan 5 tahun atau mengikuti kewajiban hukum yang berlaku
- payment transaction log: simpan 5 tahun
- subscription event history: simpan 24 bulan minimum
- tax invoice metadata: simpan mengikuti kewajiban hukum

### 6.7 AI and Recommendation Data

- recommendation output: simpan 12 bulan
- recommendation feedback accepted or rejected: simpan 24 bulan
- AI chat history default: simpan 90 hari
- AI chat summary atau condensed memory: simpan 12 bulan
- prompt dan raw completion lengkap: jangan disimpan tanpa batas; simpan 30-90 hari jika benar-benar diperlukan untuk debugging

### 6.8 Audit and Security Logs

- login audit: simpan 180 hari
- permission or role change logs: simpan 24 bulan
- critical admin actions: simpan 24 bulan
- application debug logs umum: simpan 14-30 hari

## 7. Access Window vs Physical Retention

Perlu dibedakan antara:

- `access window`: berapa banyak histori yang dapat dilihat user di dashboard
- `physical retention`: berapa lama data masih ada di backend atau archive

Contoh:

- user `FREE` hanya melihat 7 hari histori
- backend masih boleh menyimpan 30 hari untuk keperluan support, re-aggregation, dan upgrade plan

Model ini membuat:

- pengalaman upgrade lebih baik
- support lebih mudah
- migrasi data lebih aman

## 8. Owned Data vs Public Data Policy

### Owned Data

Data ini berasal dari toko milik user sendiri atau area yang dianggap sebagai data operasional user.

Contoh:

- ads metrics
- shop performance
- profit input
- recommendation berdasarkan toko user

Policy:

- retensinya lebih penting
- perlu dukungan delete by tenant
- perlu histori lebih panjang untuk analytics

### Public Market Intelligence Data

Data ini berasal dari halaman publik marketplace, misalnya hasil pencarian keyword.

Contoh:

- keyword search result
- visible price range
- visible sales hint
- ranking hasil pencarian

Policy:

- simpan lebih selektif
- prioritaskan summary dan session metadata
- detail mentah bisa cepat dibersihkan bila tidak ditandai penting oleh user

## 9. Database Storage Policy

- tabel operasional utama tetap di PostgreSQL
- tabel time-series ringan bisa tetap di PostgreSQL dengan partisi berdasarkan tanggal jika volume naik
- raw JSON besar jangan ditahan di kolom tabel utama jika sudah ada object storage
- database hanya menyimpan pointer, metadata, checksum, dan status proses untuk payload besar

Kolom yang perlu dipertimbangkan untuk payload metadata:

- `storage_key`
- `payload_hash`
- `capture_mode`
- `page_type`
- `captured_at`
- `organization_id`
- `shop_id`
- `size_bytes`
- `retention_until`

## 10. Object Storage Policy

Object storage dipakai untuk:

- raw payload JSON
- export file
- backup artifact
- attachment pendukung tertentu di masa depan

Aturan awal:

- gunakan prefix per tenant atau per environment
- simpan metadata retensi pada object record
- hapus object setelah TTL lewat dan metadata purge selesai
- kompres payload bila ukuran mulai signifikan

Struktur key awal yang disarankan:

```text
/{env}/{organization_id}/{capture_mode}/{yyyy}/{mm}/{dd}/{batch_id}.json.gz
```

## 11. Backup Policy

### Database Backup

- full backup harian
- retention harian 7-14 hari
- backup mingguan 4-8 minggu
- backup bulanan 3-6 bulan untuk fase awal

### Object Storage Backup

- backup metadata database lebih penting daripada menduplikasi semua raw payload harian
- raw payload yang memang transient tidak wajib ikut long-term backup

### Restore Drill

- lakukan uji restore berkala
- minimal verifikasi backup tidak korup
- target awal: bisa restore environment staging dari backup produksi tersanitasi

## 12. Deletion and Purge Workflow

Setiap data yang melewati masa retensi sebaiknya melalui tahapan:

1. tandai `expired`
2. antrekan purge job
3. hapus object storage lebih dulu atau sinkron dengan metadata
4. hapus metadata record
5. catat hasil purge ke audit log ringkas

Purge sebaiknya:

- idempotent
- berjalan bertahap
- punya rate limit
- tidak mengganggu workload utama

## 13. Tenant Offboarding Policy

Jika tenant berhenti berlangganan atau meminta penghapusan:

### Default Offboarding

- tenant masuk status `inactive`
- akses dashboard dibatasi
- data dipertahankan selama grace period tertentu, misalnya 30 hari

### Hard Delete Request

- identitas yang wajib disimpan untuk kewajiban legal dipisahkan
- data operasional tenant masuk antrean purge
- data analytics diagregasi anonim hanya boleh dipertahankan jika tidak bisa lagi dihubungkan ke tenant

## 14. Anonymization Policy

Jika data tetap dibutuhkan untuk product intelligence internal, gunakan anonymization:

- hapus identifier tenant
- hapus user-level identifier
- simpan hanya agregasi statistik

Contoh yang masih aman dipertahankan:

- distribusi CTR per kategori
- distribusi ROAS bucket
- volume result keyword publik per marketplace

Contoh yang tidak boleh dipertahankan tanpa dasar kuat:

- raw session yang masih menunjuk ke organization tertentu
- log prompt AI yang mengandung data shop spesifik tanpa masking

## 15. Cost Control Rules

- raw payload retention harus pendek secara default
- dashboard harus selalu membaca aggregate, bukan raw storage
- chat history harus diringkas secara periodik
- object storage perlu lifecycle cleanup otomatis
- plan benefit harus punya batas yang bisa dihitung secara finansial

## 16. Operational Jobs yang Dibutuhkan

Sistem pada fase implementasi perlu memiliki job berikut:

- raw payload expiry scheduler
- archive aggregate scheduler
- AI chat condensation job
- stale session cleanup job
- tenant offboarding cleanup job
- backup cleanup job

## 17. Observability and Audit

Minimal metric internal yang perlu dipantau:

- total object storage size per tenant
- total raw payload count per day
- purge success rate
- purge failure rate
- average payload size
- aggregate table growth per month

## 18. Dependency dengan Dokumen Lain

Dokumen ini terkait langsung dengan:

- [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)
- [08-Data-sources-and-capture-modes-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/08-Data-sources-and-capture-modes-v1.md)
- [10-Extension-capture-spec-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/10-Extension-capture-spec-v1.md)
- [12-Ingestion-payload-contract-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/12-Ingestion-payload-contract-v1.md)

## 19. Open Questions

- apakah histori `PRO` perlu benar-benar unlimited di database utama, atau unlimited secara user-facing tetapi data lama dipindahkan ke cold storage
- apakah AI chat history perlu retention berbeda per plan
- apakah saved keyword research user perlu dipisahkan dari transient keyword capture
- apakah biaya object storage akan dibebankan dalam fair usage policy untuk plan besar
