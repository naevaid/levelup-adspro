const {
  PrismaClient,
  BillingInterval,
  MarketplaceCode,
  PlanStatus,
  Prisma,
} = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

const SHOPEE_CATEGORY_FEE_ARTICLE_ID = 15965;
const SHOPEE_GRATIS_ONGKIR_ARTICLE_ID = 24877;
const SHOPEE_CATEGORY_FEE_TABLE_LAYOUT = [
  { storeTypes: ['NON_STAR', 'STAR'], primaryCategory: 'Fashion' },
  { storeTypes: ['NON_STAR', 'STAR'], primaryCategory: 'FMCG' },
  { storeTypes: ['NON_STAR', 'STAR'], primaryCategory: 'Elektronik' },
  { storeTypes: ['NON_STAR', 'STAR'], primaryCategory: 'Lifestyle' },
  { storeTypes: ['NON_STAR', 'STAR'], primaryCategory: 'Lainnya' },
  { storeTypes: ['MALL'], primaryCategory: 'Fashion' },
  { storeTypes: ['MALL'], primaryCategory: 'FMCG' },
  { storeTypes: ['MALL'], primaryCategory: 'Elektronik' },
  { storeTypes: ['MALL'], primaryCategory: 'Lifestyle' },
  { storeTypes: ['MALL'], primaryCategory: 'Lainnya' },
];
const SHOPEE_GRATIS_ONGKIR_TABLE_COUNT = 5;

const plans = [
  {
    code: 'free-monthly',
    name: 'Free',
    billingInterval: BillingInterval.MONTHLY,
    shopLimit: 1,
    memberLimit: 1,
    historyDays: 30,
    status: PlanStatus.ACTIVE,
    featuresJson: {
      analytics: true,
      recommendations: false,
      marketResearch: false,
    },
  },
  {
    code: 'starter-monthly',
    name: 'Starter',
    billingInterval: BillingInterval.MONTHLY,
    shopLimit: 3,
    memberLimit: 3,
    historyDays: 90,
    status: PlanStatus.ACTIVE,
    featuresJson: {
      analytics: true,
      recommendations: true,
      marketResearch: false,
    },
  },
  {
    code: 'pro-monthly',
    name: 'Pro',
    billingInterval: BillingInterval.MONTHLY,
    shopLimit: 10,
    memberLimit: 10,
    historyDays: 180,
    status: PlanStatus.ACTIVE,
    featuresJson: {
      analytics: true,
      recommendations: true,
      marketResearch: true,
    },
  },
  {
    code: 'agency-monthly',
    name: 'Agency',
    billingInterval: BillingInterval.MONTHLY,
    shopLimit: 50,
    memberLimit: 25,
    historyDays: 365,
    status: PlanStatus.ACTIVE,
    featuresJson: {
      analytics: true,
      recommendations: true,
      marketResearch: true,
      multiWorkspace: true,
    },
  },
];

const marketplaces = [
  {
    code: MarketplaceCode.SHOPEE,
    name: 'Shopee',
  },
  {
    code: MarketplaceCode.TIKTOK_SHOP,
    name: 'TikTok Shop',
  },
];

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 10)),
    );
}

function normalizeText(value) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function getHtmlAttributeNumber(attributes, name) {
  const match = attributes.match(new RegExp(`${name}="(\\d+)"`, 'i'));
  return match ? Number.parseInt(match[1], 10) : 1;
}

function parseHtmlTable(tableHtml) {
  const rowMatches = [
    ...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi),
  ].map((match) => match[0]);
  const activeRowspans = [];
  const grid = [];

  for (const rowHtml of rowMatches) {
    const row = [];
    let columnIndex = 0;

    const fillActiveRowspans = () => {
      while (
        activeRowspans[columnIndex] &&
        activeRowspans[columnIndex].remaining > 0
      ) {
        row[columnIndex] = activeRowspans[columnIndex].text;
        activeRowspans[columnIndex].remaining -= 1;

        if (activeRowspans[columnIndex].remaining === 0) {
          activeRowspans[columnIndex] = null;
        }

        columnIndex += 1;
      }
    };

    fillActiveRowspans();

    const cellMatches = [
      ...rowHtml.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi),
    ];

    for (const [, , attributes, html] of cellMatches) {
      while (row[columnIndex] !== undefined) {
        columnIndex += 1;
      }

      const text = normalizeText(html);
      const rowspan = getHtmlAttributeNumber(attributes, 'rowspan');
      const colspan = getHtmlAttributeNumber(attributes, 'colspan');

      for (let offset = 0; offset < colspan; offset += 1) {
        row[columnIndex + offset] = text;

        if (rowspan > 1) {
          activeRowspans[columnIndex + offset] = {
            text,
            remaining: rowspan - 1,
          };
        }
      }

      columnIndex += colspan;
      fillActiveRowspans();
    }

    grid.push(row.map((value) => value || ''));
  }

  return grid;
}

function parseFeePercent(value) {
  const parsed = Number.parseFloat(
    value.replace(/%/g, '').replace(/\*/g, '').replace(',', '.').trim(),
  );

  if (!Number.isFinite(parsed)) {
    throw new Error(`Tidak bisa membaca fee persen dari nilai "${value}".`);
  }

  return parsed;
}

function parseFeeCap(value) {
  const normalized = normalizeText(value);
  const amountMatch = normalized.match(/Rp\s*([\d.,]+)/i);
  if (!amountMatch) {
    return 0;
  }

  const numericPortion = amountMatch[1].replace(/,/g, '.').trim();
  const parts = numericPortion.split('.');
  const joinedDigits = parts.join('');
  let parsed = Number.parseInt(joinedDigits, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Tidak bisa membaca cap fee dari nilai "${value}".`);
  }

  if (parts.length === 2 && /^0{4,}$/.test(parts[1] ?? '') && parsed >= 100000) {
    parsed = Math.round(parsed / 10);
  }

  return parsed;
}

function parseCappedFeeCell(value) {
  return {
    pct: parseFeePercent(value),
    cap: parseFeeCap(value),
  };
}

function normalizeSeedLookupPart(value) {
  return normalizeText(value).toLowerCase();
}

function buildShopeeFeeLookupKey(category, subCategory, productTypes) {
  return [
    normalizeSeedLookupPart(category),
    normalizeSeedLookupPart(subCategory),
    normalizeSeedLookupPart(productTypes),
  ].join('|||');
}

function buildShopeeFeeSubCategoryKey(category, subCategory) {
  return [
    normalizeSeedLookupPart(category),
    normalizeSeedLookupPart(subCategory),
  ].join('|||');
}

function summarizeProductBucket(value) {
  const normalized = normalizeText(value).replace(/^&\s+/, '');

  if (!normalized) {
    return '';
  }

  if (normalized.length <= 90) {
    return normalized;
  }

  const parts = normalized
    .split(',')
    .map((part) => part.replace(/^&\s+/, '').trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return `${normalized.slice(0, 87)}...`;
  }

  const summary = parts.slice(0, 2).join(', ');
  return parts.length > 2 ? `${summary}, dll` : summary;
}

function buildSeedNote(productTypes) {
  const normalized = normalizeText(productTypes);
  if (!normalized) {
    return null;
  }

  return truncateText(normalized, 300);
}

async function fetchShopeeArticleContent(articleId, articleLabel) {
  const spcCds = randomUUID();
  const articleUrl = `https://seller.shopee.co.id/help/api/v3/article/detail/?SPC_CDS=${spcCds}&SPC_CDS_VER=2&lang=default&article_id=${articleId}`;

  const response = await fetch(articleUrl, {
    headers: {
      accept: 'application/json, text/plain, */*',
      referer: `https://seller.shopee.co.id/edu/article/${articleId}`,
      'shopee-language': 'default',
      cookie: `SPC_CDS=${spcCds}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil artikel Shopee ${articleLabel}. Status: ${response.status}.`,
    );
  }

  const payload = await response.json();
  const content = payload?.data?.content;

  if (typeof content !== 'string' || !content.includes('<table')) {
    throw new Error(`Konten artikel Shopee ${articleLabel} tidak berisi tabel.`);
  }

  return content;
}

async function buildShopeeGratisOngkirFeeLookup() {
  const content = await fetchShopeeArticleContent(
    SHOPEE_GRATIS_ONGKIR_ARTICLE_ID,
    'Gratis Ongkir XTRA',
  );
  const tables = [...content.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(
    (match) => match[0],
  );

  if (tables.length < SHOPEE_GRATIS_ONGKIR_TABLE_COUNT) {
    throw new Error(
      `Jumlah tabel Gratis Ongkir XTRA Shopee tidak sesuai. Ditemukan ${tables.length} tabel.`,
    );
  }

  const exactMatches = new Map();
  const fallbackMatches = new Map();
  const fallbackCounts = new Map();

  for (let tableIndex = 0; tableIndex < SHOPEE_GRATIS_ONGKIR_TABLE_COUNT; tableIndex += 1) {
    const rows = parseHtmlTable(tables[tableIndex])
      .slice(1)
      .filter((row) => (row[4] || '').includes('%') && (row[5] || '').includes('%'))
      .map((row) => {
        const regularFee = parseCappedFeeCell(row[4] || '');
        const specialFee = parseCappedFeeCell(row[5] || '');
        return {
          secondaryCategory: row[0],
          subCategory: row[2],
          productTypes: row[3],
          gratisOngkirPctRegular: regularFee.pct,
          gratisOngkirCapRegular: regularFee.cap,
          gratisOngkirPctSpecial: specialFee.pct,
          gratisOngkirCapSpecial: specialFee.cap,
        };
      })
      .filter(
        (row) =>
          row.secondaryCategory &&
          row.subCategory &&
          row.productTypes &&
          Number.isFinite(row.gratisOngkirPctRegular) &&
          Number.isFinite(row.gratisOngkirPctSpecial),
      );

    for (const row of rows) {
      const exactKey = buildShopeeFeeLookupKey(
        row.secondaryCategory,
        row.subCategory,
        row.productTypes,
      );
      exactMatches.set(exactKey, row);

      const fallbackKey = buildShopeeFeeSubCategoryKey(
        row.secondaryCategory,
        row.subCategory,
      );
      fallbackCounts.set(fallbackKey, (fallbackCounts.get(fallbackKey) || 0) + 1);
      if (!fallbackMatches.has(fallbackKey)) {
        fallbackMatches.set(fallbackKey, row);
      }
    }
  }

  return { exactMatches, fallbackMatches, fallbackCounts };
}

function findShopeeGratisOngkirMatch(lookup, secondaryCategory, subCategory, productTypes) {
  const exactKey = buildShopeeFeeLookupKey(secondaryCategory, subCategory, productTypes);
  const exactMatch = lookup.exactMatches.get(exactKey);
  if (exactMatch) {
    return exactMatch;
  }

  const fallbackKey = buildShopeeFeeSubCategoryKey(secondaryCategory, subCategory);
  if ((lookup.fallbackCounts.get(fallbackKey) || 0) === 1) {
    return lookup.fallbackMatches.get(fallbackKey) || null;
  }

  return null;
}

async function buildShopeeCategoryFeeSeedEntries() {
  const [content, gratisOngkirLookup] = await Promise.all([
    fetchShopeeArticleContent(SHOPEE_CATEGORY_FEE_ARTICLE_ID, 'fee kategori'),
    buildShopeeGratisOngkirFeeLookup(),
  ]);
  const tables = [...content.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(
    (match) => match[0],
  );

  if (tables.length < SHOPEE_CATEGORY_FEE_TABLE_LAYOUT.length) {
    throw new Error(
      `Jumlah tabel fee kategori Shopee tidak sesuai. Ditemukan ${tables.length} tabel.`,
    );
  }

  const entries = [];

  for (
    let tableIndex = 0;
    tableIndex < SHOPEE_CATEGORY_FEE_TABLE_LAYOUT.length;
    tableIndex += 1
  ) {
    const layout = SHOPEE_CATEGORY_FEE_TABLE_LAYOUT[tableIndex];
    const rows = parseHtmlTable(tables[tableIndex])
      .slice(1)
      .map((row) => ({
        secondaryCategory: row[0],
        subCategory: row[1],
        productTypes: row[2],
        feePercent: parseFeePercent(row[3]),
      }))
      .filter(
        (row) =>
          row.secondaryCategory &&
          row.subCategory &&
          row.productTypes &&
          Number.isFinite(row.feePercent),
      );

    const duplicateCounts = new Map();
    for (const row of rows) {
      const duplicateKey = `${row.secondaryCategory}|||${row.subCategory}`;
      duplicateCounts.set(
        duplicateKey,
        (duplicateCounts.get(duplicateKey) || 0) + 1,
      );
    }

    const usedLabels = new Set();

    for (const row of rows) {
      const duplicateKey = `${row.secondaryCategory}|||${row.subCategory}`;
      const isDuplicate = (duplicateCounts.get(duplicateKey) || 0) > 1;
      let categoryName = row.subCategory;

      if (isDuplicate) {
        const summary = summarizeProductBucket(row.productTypes);
        categoryName =
          summary && summary !== row.subCategory
            ? `${row.subCategory} - ${summary}`
            : `${row.subCategory} (${row.feePercent.toFixed(2)}%)`;
      }

      categoryName = truncateText(categoryName, 160);

      let uniqueCategoryName = categoryName;
      let suffix = 1;
      while (
        usedLabels.has(`${row.secondaryCategory}|||${uniqueCategoryName}`)
      ) {
        uniqueCategoryName = truncateText(
          `${categoryName} #${suffix}`,
          160,
        );
        suffix += 1;
      }

      usedLabels.add(`${row.secondaryCategory}|||${uniqueCategoryName}`);

      const gratisOngkirMatch = findShopeeGratisOngkirMatch(
        gratisOngkirLookup,
        row.secondaryCategory,
        row.subCategory,
        row.productTypes,
      );

      for (const storeType of layout.storeTypes) {
        entries.push({
          storeType,
          primaryCategory: layout.primaryCategory,
          secondaryCategory: row.secondaryCategory,
          categoryName: uniqueCategoryName,
          feePercent: row.feePercent,
          gratisOngkirPctRegular: gratisOngkirMatch?.gratisOngkirPctRegular ?? 0,
          gratisOngkirCapRegular: gratisOngkirMatch?.gratisOngkirCapRegular ?? 0,
          gratisOngkirPctSpecial: gratisOngkirMatch?.gratisOngkirPctSpecial ?? 0,
          gratisOngkirCapSpecial: gratisOngkirMatch?.gratisOngkirCapSpecial ?? 0,
          notes: buildSeedNote(row.productTypes),
        });
      }
    }
  }

  return entries;
}

async function upsertMarketplaceCategoryFee({
  organizationId,
  marketplaceId,
  storeType,
  primaryCategory,
  secondaryCategory,
  categoryName,
  feePercent,
  gratisOngkirPctRegular,
  gratisOngkirCapRegular,
  gratisOngkirPctSpecial,
  gratisOngkirCapSpecial,
  isActive,
  notes,
}) {
  try {
    await prisma.marketplaceCategoryFee.create({
      data: {
        organizationId,
        marketplaceId,
        storeType,
        primaryCategory,
        secondaryCategory,
        categoryName,
        feePercent,
        gratisOngkirPctRegular,
        gratisOngkirCapRegular,
        gratisOngkirPctSpecial,
        gratisOngkirCapSpecial,
        isActive,
        notes,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      await prisma.marketplaceCategoryFee.updateMany({
        where: {
          organizationId,
          marketplaceId,
          storeType,
          primaryCategory,
          secondaryCategory,
          categoryName,
        },
        data: {
          feePercent,
          gratisOngkirPctRegular,
          gratisOngkirCapRegular,
          gratisOngkirPctSpecial,
          gratisOngkirCapSpecial,
          isActive,
          notes,
        },
      });
      return;
    }

    throw error;
  }
}

async function seedShopeeCategoryFees() {
  const shopeeMarketplace = await prisma.marketplace.findUnique({
    where: { code: MarketplaceCode.SHOPEE },
  });

  if (!shopeeMarketplace) {
    throw new Error('Marketplace Shopee belum tersedia saat proses seed fee kategori.');
  }

  const organizations = await prisma.organization.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (organizations.length === 0) {
    console.log(
      'Tidak ada organisasi yang tersedia. Seeder fee kategori Shopee dilewati.',
    );
    return;
  }

  const feeEntries = await buildShopeeCategoryFeeSeedEntries();
  console.log(
    `Menyiapkan ${feeEntries.length} fee kategori Shopee untuk ${organizations.length} organisasi.`,
  );

  for (const organization of organizations) {
    const existingFees = await prisma.marketplaceCategoryFee.findMany({
      where: {
        organizationId: organization.id,
        marketplaceId: shopeeMarketplace.id,
      },
      select: {
        id: true,
        storeType: true,
        primaryCategory: true,
        secondaryCategory: true,
        categoryName: true,
        gratisOngkirPctRegular: true,
        gratisOngkirCapRegular: true,
        gratisOngkirPctSpecial: true,
        gratisOngkirCapSpecial: true,
      },
    });
    const existingFeeMap = new Map(
      existingFees.map((fee) => [
        [
          fee.storeType,
          fee.primaryCategory.trim().toLowerCase(),
          (fee.secondaryCategory || '').trim().toLowerCase(),
          fee.categoryName.trim().toLowerCase(),
        ].join('|||'),
        fee,
      ]),
    );
    const existingBucketKeys = new Set(
      existingFees.map((fee) =>
        [
          fee.storeType,
          fee.primaryCategory.trim().toLowerCase(),
          (fee.secondaryCategory || '').trim().toLowerCase(),
        ].join('|||'),
      ),
    );

    for (const entry of feeEntries) {
      const bucketKey = [
        entry.storeType,
        entry.primaryCategory.trim().toLowerCase(),
        (entry.secondaryCategory || '').trim().toLowerCase(),
      ].join('|||');
      const existingFee = existingFeeMap.get(
        [
          entry.storeType,
          entry.primaryCategory.trim().toLowerCase(),
          (entry.secondaryCategory || '').trim().toLowerCase(),
          entry.categoryName.trim().toLowerCase(),
        ].join('|||'),
      );

      if (
        existingFee &&
        existingFee.gratisOngkirPctRegular === 0 &&
        existingFee.gratisOngkirCapRegular === 0 &&
        existingFee.gratisOngkirPctSpecial === 0 &&
        existingFee.gratisOngkirCapSpecial === 0 &&
        (entry.gratisOngkirPctRegular > 0 || entry.gratisOngkirPctSpecial > 0)
      ) {
        await prisma.marketplaceCategoryFee.update({
          where: { id: existingFee.id },
          data: {
            gratisOngkirPctRegular: entry.gratisOngkirPctRegular,
            gratisOngkirCapRegular: entry.gratisOngkirCapRegular,
            gratisOngkirPctSpecial: entry.gratisOngkirPctSpecial,
            gratisOngkirCapSpecial: entry.gratisOngkirCapSpecial,
          },
        });
      }

      if (existingBucketKeys.has(bucketKey)) {
        continue;
      }

      await upsertMarketplaceCategoryFee({
        organizationId: organization.id,
        marketplaceId: shopeeMarketplace.id,
        storeType: entry.storeType,
        primaryCategory: entry.primaryCategory,
        secondaryCategory: entry.secondaryCategory,
        categoryName: entry.categoryName,
        feePercent: entry.feePercent,
        gratisOngkirPctRegular: entry.gratisOngkirPctRegular,
        gratisOngkirCapRegular: entry.gratisOngkirCapRegular,
        gratisOngkirPctSpecial: entry.gratisOngkirPctSpecial,
        gratisOngkirCapSpecial: entry.gratisOngkirCapSpecial,
        isActive: true,
        notes: entry.notes,
      });
    }
  }
}

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  for (const marketplace of marketplaces) {
    await prisma.marketplace.upsert({
      where: { code: marketplace.code },
      update: marketplace,
      create: marketplace,
    });
  }

  await seedShopeeCategoryFees();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
