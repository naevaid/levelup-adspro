const {
  PrismaClient,
  BillingInterval,
  MarketplaceCode,
  PlanStatus,
} = require('@prisma/client');

const prisma = new PrismaClient();

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
