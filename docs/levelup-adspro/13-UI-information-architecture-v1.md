# LevelUP adsPRO - UI Information Architecture v1

## 1. Tujuan

Dokumen ini menyusun arsitektur informasi UI `LevelUP adsPRO` agar modul produk, navigasi, dan struktur halaman jelas sejak awal.

Fokus v1:

- tenant app
- connected shop analytics
- public market intelligence workspace
- subscription dan team management

## 2. Prinsip Navigasi

- navigasi harus mengikuti mental model user: `organization -> shops -> analytics -> actions`
- fitur market research harus bisa diakses tanpa bergantung pada connected shop
- halaman yang sering dipakai owner dan manager harus mudah dicapai maksimal 2 klik
- informasi penting seperti freshness, plan, dan alert harus mudah terlihat

## 3. Navigation Groups

### Group A - Core

- Dashboard
- Shops
- Market Research

### Group B - Performance

- Ads Analytics
- Product Analytics
- Profit Analytics
- Recommendations

### Group C - Organization

- Team
- Subscription
- Settings

### Group D - Support

- Alerts
- Help

## 4. Sidebar Draft

Urutan sidebar yang disarankan:

1. Dashboard
2. Shops
3. Market Research
4. Ads Analytics
5. Product Analytics
6. Profit Analytics
7. Recommendations
8. Alerts
9. Team
10. Subscription
11. Settings

## 5. Top Bar Draft

Top bar minimal berisi:

- organization switcher
- shop filter cepat
- date range picker
- freshness indicator
- alert icon
- user menu

## 6. Halaman Inti

## 6.1 Dashboard

Tujuan:

- memberi ringkasan kondisi bisnis dan iklan dalam satu layar

Komponen:

- KPI cards
- trend chart utama
- top campaign
- worst campaign
- top product
- recommendation summary
- sync freshness card

## 6.2 Shops

Tujuan:

- mengelola daftar shop yang terhubung ke organization

Subhalaman:

- shop list
- create shop
- shop detail

Komponen shop detail:

- metadata shop
- marketplace
- sync health
- last sync
- connection status
- placeholder future actions

## 6.3 Market Research

Tujuan:

- menjadi workspace untuk keyword research dan riset produk hero

Subhalaman:

- keyword session list
- keyword session detail
- saved result

Komponen:

- search keyword history
- result count
- price range summary
- repeated shop hints
- top observed products

## 6.4 Ads Analytics

Tujuan:

- menampilkan performa campaign secara terstruktur

Komponen:

- filters
- campaign performance table
- trend charts
- top campaign widget
- worst campaign widget

## 6.5 Product Analytics

Tujuan:

- memberi ranking dan performa produk

Komponen:

- top product
- worst product
- product table
- fast/slow moving indicator
- product profit snapshot

## 6.6 Profit Analytics

Tujuan:

- menampilkan profit riil dan break even insights

Komponen:

- net profit KPI
- gross profit KPI
- profit margin
- break even ROAS summary
- missing cost warning

## 6.7 Recommendations

Tujuan:

- menjadi daftar prioritas aksi yang harus ditindak user

Komponen:

- recommendation list
- severity filter
- object type filter
- evidence panel
- AI explanation summary

## 6.8 Alerts

Tujuan:

- menampilkan event penting yang perlu diperhatikan

Komponen:

- alert list
- unread count
- mark as read
- severity badges

## 6.9 Team

Tujuan:

- mengelola anggota organization

Komponen:

- member list
- invite member
- role badge
- status member

## 6.10 Subscription

Tujuan:

- menampilkan plan dan entitlement organisasi

Komponen:

- current plan
- quota usage
- invoice history
- upgrade CTA

## 6.11 Settings

Tujuan:

- tempat konfigurasi dasar tenant

Komponen awal:

- organization profile
- default profit settings
- notification preference

## 7. Role-Based UI Visibility

### Owner

Lihat semua menu.

### Manager

Lihat:

- Dashboard
- Shops
- Market Research
- Ads Analytics
- Product Analytics
- Profit Analytics
- Recommendations
- Alerts
- Team

Tidak wajib lihat billing sensitif.

### Staff

Lihat:

- Dashboard
- Market Research
- Ads Analytics
- Product Analytics
- Recommendations
- Alerts

Akses terbatas ke settings dan team.

## 8. First-Time User Flow

Urutan onboarding yang disarankan:

1. Signup
2. Create organization
3. Pilih plan default
4. Tambah shop pertama atau skip
5. Install extension
6. Masuk ke dashboard atau market research

Catatan:

- user harus bisa masuk ke `Market Research` walau belum menambah shop

## 9. Empty States

Setiap modul penting harus punya empty state yang jelas.

### Dashboard Empty State

- belum ada data sync
- CTA: tambah shop atau install extension

### Shops Empty State

- belum ada shop
- CTA: tambah shop

### Market Research Empty State

- belum ada saved keyword research
- CTA: buka Shopee dan mulai capture keyword

### Recommendations Empty State

- belum ada rekomendasi
- CTA: sinkronkan data lebih dulu

## 10. Information Hierarchy Priorities

### Owner View Priority

1. KPI bisnis
2. profit
3. recommendation
4. shop health
5. subscription usage

### Manager View Priority

1. campaign issues
2. recommendation
3. trend chart
4. product ranking

### Staff View Priority

1. taskable insight
2. recommendation
3. campaign table

## 11. Design Notes

- `Market Research` sebaiknya tidak ditempatkan terlalu dalam karena ini berpotensi menjadi acquisition feature
- `Recommendations` harus mudah diakses karena menjadi diferensiasi utama produk
- freshness indicator sebaiknya selalu terlihat di top bar atau dashboard hero area

## 12. Open Questions

- apakah `Market Research` lebih cocok sebagai menu utama atau submenu di bawah analytics
- apakah owner perlu landing dashboard yang berbeda dari manager
- apakah shops detail page perlu punya tab `Research`, `Analytics`, `Profit` sejak awal
