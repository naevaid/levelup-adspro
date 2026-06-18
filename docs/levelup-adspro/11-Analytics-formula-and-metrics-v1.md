# LevelUP adsPRO - Analytics Formula and Metrics v1

## 1. Tujuan

Dokumen ini mendefinisikan metric utama dan formula perhitungan awal untuk `LevelUP adsPRO`. Tujuannya agar backend, frontend, AI layer, dan recommendation engine memakai definisi yang konsisten.

## 2. Prinsip Umum

- semua formula harus konsisten lintas dashboard dan AI output
- jika data input tidak lengkap, sistem harus menandai metric sebagai estimasi
- revenue tidak boleh dianggap sama dengan profit
- AI explanation harus merujuk ke metric yang dihitung dari formula ini

## 3. Definisi Input Dasar

Input utama yang dipakai:

- `impressions`
- `clicks`
- `orders`
- `units_sold`
- `revenue`
- `ad_spend`
- `cogs`
- `marketplace_fee`
- `admin_fee`
- `shipping_subsidy`
- `packaging_cost`
- `affiliate_cost`

## 4. Formula Traffic and Conversion

### CTR

```text
CTR = clicks / impressions
```

Jika `impressions = 0`, maka `CTR = 0`.

### CVR

```text
CVR = orders / clicks
```

Jika `clicks = 0`, maka `CVR = 0`.

### CPC

```text
CPC = ad_spend / clicks
```

Jika `clicks = 0`, maka `CPC = 0`.

### CPM

```text
CPM = (ad_spend / impressions) * 1000
```

Jika `impressions = 0`, maka `CPM = 0`.

## 5. Formula Sales and Order Value

### AOV

```text
AOV = revenue / orders
```

Jika `orders = 0`, maka `AOV = 0`.

### Revenue per Click

```text
RPC = revenue / clicks
```

Jika `clicks = 0`, maka `RPC = 0`.

### Revenue per Impression

```text
RPI = revenue / impressions
```

Jika `impressions = 0`, maka `RPI = 0`.

## 6. Formula Ads Efficiency

### ROAS

```text
ROAS = revenue / ad_spend
```

Jika `ad_spend = 0`, maka:

- jika `revenue > 0`, tampilkan sebagai `N/A` atau `infinite` sesuai keputusan UI
- jika `revenue = 0`, maka `ROAS = 0`

### Ad Cost Ratio

```text
Ad Cost Ratio = ad_spend / revenue
```

Jika `revenue = 0`, maka `Ad Cost Ratio = 0` atau `N/A` sesuai konteks UI.

## 7. Profit Formulas

### Gross Profit

```text
Gross Profit = revenue - cogs_total
```

Di mana:

```text
cogs_total = cogs_per_unit * units_sold
```

### Total Cost

```text
Total Cost = cogs_total
           + ad_spend
           + marketplace_fee
           + admin_fee
           + shipping_subsidy
           + packaging_cost
           + affiliate_cost
```

### Net Profit

```text
Net Profit = revenue - Total Cost
```

### Profit Margin

```text
Profit Margin = net_profit / revenue
```

Jika `revenue = 0`, maka `Profit Margin = 0`.

## 8. Break Even ROAS

### Definisi

`Break Even ROAS` adalah ROAS minimum agar campaign tidak rugi.

### Formula Sederhana

```text
Break Even ROAS = revenue / maximum_allowed_ad_spend
```

Dalam implementasi yang lebih praktis untuk satu produk:

```text
Break Even ROAS = selling_price / allowed_ad_cost
```

Atau jika dihitung dari margin:

```text
Break Even ROAS = 1 / contribution_margin_ratio
```

Di mana:

```text
contribution_margin_ratio =
  (revenue - non_ad_cost_total) / revenue
```

dan:

```text
non_ad_cost_total =
  cogs_total
  + marketplace_fee
  + admin_fee
  + shipping_subsidy
  + packaging_cost
  + affiliate_cost
```

Jika `contribution_margin_ratio <= 0`, maka:

- produk secara struktur biaya tidak layak diiklankan
- `Break Even ROAS` ditandai `invalid` atau `not achievable`

## 8A. Product ROAS Estimator (Extension)

Untuk modal `Kalkulator ROAS` di extension, pendekatan yang dipakai adalah estimator cepat per produk, bukan analytics historis campaign.

### Input Minimum

- `selling_price`
- `hpp`
- `operasional`
- `category_fee_percent`
- `promo_xtra_enabled`
- `order_processing_fee`

### Biaya Shopee (Total)

```text
category_fee_amount = selling_price * category_fee_percent
promo_xtra_fee = jika aktif, min(selling_price * 4.5%, 60000)
order_processing_fee = 1250

total_shopee_cost =
  category_fee_amount
  + promo_xtra_fee
  + order_processing_fee
```

### Biaya Pokok Sebelum Iklan

```text
base_cost_before_ads =
  hpp
  + operasional
  + total_shopee_cost
```

### Profit Kotor Sebelum Iklan

```text
gross_profit_before_ads =
  selling_price - base_cost_before_ads
```

### Tier ROAS Dinamis

Tier di extension dihitung dari porsi `gross_profit_before_ads` yang dialokasikan sebagai biaya iklan:

- `Rugi`: 100% dari profit sebelum iklan
- `Kompetitif`: 70% dari profit sebelum iklan
- `Konservatif`: 50% dari profit sebelum iklan
- `Prospektif`: 25% dari profit sebelum iklan

Rumus:

```text
ad_spend_for_tier = gross_profit_before_ads * tier_share
tier_roas = selling_price / ad_spend_for_tier
profit_after_ads_for_tier = gross_profit_before_ads - ad_spend_for_tier
```

Catatan:

- jika `gross_profit_before_ads <= 0`, maka produk secara struktur biaya belum layak diiklankan dan tier ROAS harus ditandai tidak valid / belum bisa dihitung.
- nilai tier ROAS harus berubah realtime ketika user mengubah `HPP`, `Harga Jual`, `Operasional`, `Kategori`, atau `Promo Xtra`.

## 9. Growth Formulas

### Revenue Growth Rate

```text
Growth Rate = (current_period - previous_period) / previous_period
```

Jika `previous_period = 0`, maka:

- jika `current_period > 0`, tandai sebagai `new growth`
- jika `current_period = 0`, maka `Growth Rate = 0`

Formula ini dipakai untuk:

- revenue growth
- orders growth
- spend growth
- profit growth

## 10. Product Ranking Logic

Untuk `Top Product` dan `Worst Product`, ranking MVP disarankan memakai urutan prioritas:

### Top Product

1. net profit tertinggi
2. jika seri, revenue tertinggi
3. jika seri, ROAS tertinggi

### Worst Product

1. net profit terendah
2. jika seri, ROAS terendah
3. jika seri, spend tertinggi

## 11. Campaign Ranking Logic

### Top Campaign

1. net profit tertinggi
2. ROAS di atas target
3. spend cukup signifikan

### Worst Campaign

1. net profit negatif
2. ROAS di bawah break even
3. spend signifikan

Catatan:

- campaign dengan volume terlalu kecil bisa dikelompokkan sebagai `insufficient data`

## 12. Recommendation Threshold Examples

### Scale Recommendation

Rekomendasikan `scale` jika:

- ROAS > target ROAS
- net profit > 0
- volume order memenuhi minimum threshold

### Pause Recommendation

Rekomendasikan `pause` jika:

- net profit < 0
- spend melewati threshold minimum
- data tidak termasuk low-volume noise

### Improve Creative Recommendation

Rekomendasikan `improve creative` jika:

- CTR rendah
- impressions cukup tinggi
- clicks rendah dibanding exposure

### Improve PDP Recommendation

Rekomendasikan `improve PDP` jika:

- CTR cukup baik
- CVR rendah

### Reduce Bid Recommendation

Rekomendasikan `reduce bid` jika:

- CPC tinggi
- ROAS rendah
- profit margin tertekan

## 13. Data Completeness Flags

Sistem perlu menandai apakah metric:

- `final`
- `estimated`
- `insufficient_data`

### Contoh

- profit tanpa COGS lengkap -> `estimated`
- ROAS dengan spend nol -> `special_case`
- campaign dengan impressions kecil -> `insufficient_data`

## 14. Market Research Metrics

Untuk mode `Public Market Intelligence`, metric awal yang bisa dipakai:

- number of results captured
- price range min/max
- median visible price
- frequency of repeated shops
- visible sales distribution

Catatan:

- metric ini bukan revenue internal seller
- tidak boleh dicampur dengan metrik owned shop

## 15. Metric Display Rules

### Persentase

- CTR
- CVR
- Profit Margin
- Growth Rate

Semua ditampilkan sebagai persen di UI.

### Currency

- revenue
- ad spend
- profit
- CPC
- AOV

Semua mengikuti currency shop atau default marketplace terkait.

### Ratio

- ROAS
- Break Even ROAS

Ditampilkan sebagai angka rasio, misalnya `3.2x`.

## 16. Open Questions

- apakah ROAS target dihitung hanya dari profit final atau boleh memakai model estimasi default
- apakah `units_sold` selalu konsisten dengan `orders` di semua marketplace
- apakah visible sales hint publik perlu dinormalisasi ke bucket tertentu
- apakah campaign ranking harus memakai `profit first` atau bisa disediakan mode `revenue first`
