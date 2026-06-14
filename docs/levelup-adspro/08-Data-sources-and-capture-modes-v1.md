# LevelUP adsPRO - Data Sources and Capture Modes v1

## 1. Tujuan

Dokumen ini menjelaskan sumber data utama `LevelUP adsPRO` dan cara sistem menangkap data tersebut. Fokus khusus dokumen ini adalah membedakan data `owned` milik toko user dan data `public` untuk riset market.

## 2. Kenapa Perlu Dipisah

Tidak semua fitur membutuhkan `connect toko`.

Secara produk, ada dua kelompok fitur:

- fitur untuk memahami performa toko sendiri
- fitur untuk memahami market dan kompetitor

Karena sumber datanya berbeda, sistem juga harus membedakan:

- cara capture
- permission
- schema
- retention
- UI dan onboarding

## 3. Capture Mode A - Connected Shop

### Definisi

Mode ini dipakai untuk membaca data toko milik user sendiri dari dashboard seller atau dashboard ads marketplace.

### Contoh Data

- campaign
- ad spend
- revenue
- orders
- product performance
- ROAS
- CTR
- CVR

### Karakteristik

- perlu login akun SaaS
- perlu shop yang terhubung atau terdeteksi
- dipakai untuk analytics, profit, recommendation, dan alert

### Cocok untuk Fitur

- overview dashboard
- ads analytics
- profit analytics
- break even ROAS
- scale atau pause recommendation

## 4. Capture Mode B - Public Market Intelligence

### Definisi

Mode ini dipakai untuk membaca data publik marketplace tanpa harus connect toko user sendiri.

### Contoh Skenario

User membuka web Shopee lalu mencari keyword tertentu. Extension membaca halaman hasil pencarian tersebut dan menangkap data publik yang tersedia.

### Contoh Data

- keyword pencarian
- nama produk
- range harga
- data penjualan yang terlihat
- nama toko publik bila tersedia
- ranking hasil pencarian bila tersedia
- URL produk

### Karakteristik

- tidak perlu login toko marketplace
- cukup login akun sistem jika user ingin menyimpan hasil riset
- cocok untuk riset produk hero dan tren kompetitor

### Cocok untuk Fitur

- riset produk hero
- intip tren kompetitor
- keyword research
- saved research session
- price range observation

## 5. Contoh Alur Riset Keyword Shopee

1. User login ke akun `LevelUP adsPRO`
2. User install dan mengaktifkan extension
3. User membuka situs Shopee
4. User mengetik keyword tertentu di pencarian
5. Extension membaca halaman hasil pencarian
6. Extension menangkap data publik yang terlihat
7. User memilih apakah hasil riset ingin disimpan
8. Jika disimpan, data dikirim ke backend tenant user
9. Sistem menampilkan histori riset keyword dan kandidat produk potensial

## 6. Prinsip Produk

### Prinsip 1

`Connected Shop` tidak boleh menjadi syarat untuk menggunakan fitur market research.

### Prinsip 2

`Public Market Intelligence` tidak boleh mengganggu pipeline analytics toko sendiri.

### Prinsip 3

Satu extension boleh melayani dua mode ini, tetapi parser dan schema harus dipisah.

### Prinsip 4

Data publik hanya disimpan jika memang dibutuhkan user atau memang masuk workflow riset.

## 7. Data Fields Minimum untuk Keyword Research

Untuk MVP atau MVP+, hasil riset keyword minimal sebaiknya menyimpan:

- marketplace
- keyword
- captured_at
- product_title
- product_url
- shop_name bila tersedia
- listed_price_min
- listed_price_max
- sales_hint
- ranking_position
- raw_snapshot_reference

## 8. Storage Policy

### Jika User Belum Login Sistem

- data tidak perlu disimpan permanen
- extension bisa menampilkan preview lokal bila nanti dibutuhkan

### Jika User Sudah Login Sistem

- data boleh disimpan ke organization terkait
- hasil riset dapat diberi tag atau label potensial
- session riset dapat dimunculkan kembali di dashboard

## 9. Permission Model

### Connected Shop

- hanya owner atau role yang diizinkan yang boleh menambah shop
- data shop wajib terikat ke organization

### Public Market Intelligence

- user cukup menjadi anggota organization
- tidak perlu entitlement `connected shop`
- bisa dijadikan fitur pembuka untuk calon user baru

## 10. Product Strategy Note

Mode `Public Market Intelligence` bisa menjadi funnel yang sangat baik:

- user bisa mencoba value produk tanpa onboarding berat
- user belum perlu connect toko
- setelah percaya dengan hasil riset, user terdorong mengaktifkan fitur connected shop

Artinya, fitur ini tidak hanya berguna secara produk, tetapi juga berguna untuk acquisition dan activation.

## 11. Risiko Teknis

- struktur halaman pencarian marketplace bisa berubah
- elemen penjualan atau ranking bisa tidak konsisten
- parser publik harus lebih toleran terhadap perubahan UI

## 12. Risiko Produk

- user dapat menganggap data publik selalu lengkap, padahal tidak
- sinyal penjualan publik mungkin hanya proxy, bukan angka final
- hasil riset harus diposisikan sebagai insight, bukan kepastian

## 13. Rekomendasi Tahapan

### Tahap 1

- fokus ke `Connected Shop` untuk core analytics

### Tahap 2

- tambahkan `Public Market Intelligence` untuk keyword research Shopee

### Tahap 3

- kembangkan competitor trend, saved watchlist, dan AI research summary

## 14. Keterkaitan Dokumen

Dokumen ini melengkapi:

- [01-PRD-LevelUP-adsPRO-v2.1-refined.md](file:///d:/levelup-adspro/docs/levelup-adspro/01-PRD-LevelUP-adsPRO-v2.1-refined.md)
- [03-Architecture-and-data-model-v1.md](file:///d:/levelup-adspro/docs/levelup-adspro/03-Architecture-and-data-model-v1.md)
- [04-MVP-backlog-and-user-stories.md](file:///d:/levelup-adspro/docs/levelup-adspro/04-MVP-backlog-and-user-stories.md)
