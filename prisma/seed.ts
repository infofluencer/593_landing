import { PrismaClient, type TenantType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GOOGLE_ADS_CUSTOMER_BY_SLUG } from "../src/lib/panel/google-ads-customer-map";

const prisma = new PrismaClient();

type SeedTenant = {
  slug: string;
  name: string;
  website: string;
  metaAccountId: string;
  type: TenantType;
  monthlyBudget: number;
  mapping: {
    adsCustomerId: string | null;
    ga4PropertyId: string | null;
    gtmContainerId: string | null;
    gscSiteUrl: string | null;
    merchantId: string | null;
  };
};

/** Faz 0 seed: 1 ecommerce (mareen) + 1 lead (demo). */
const SEED_TENANTS: SeedTenant[] = [
  {
    slug: "mareen",
    name: "MAREEN",
    website: "https://mareen.com.tr/",
    metaAccountId: "act_mareen_001",
    type: "ecommerce",
    monthlyBudget: 120000,
    mapping: {
      adsCustomerId: GOOGLE_ADS_CUSTOMER_BY_SLUG.mareen ?? null,
      ga4PropertyId: null,
      gtmContainerId: null,
      gscSiteUrl: "https://mareen.com.tr/",
      merchantId: null,
    },
  },
  {
    slug: "demo",
    name: "Demo Lead Marka",
    website: "https://example.com",
    metaAccountId: "act_phase0_demo",
    type: "lead",
    monthlyBudget: 50000,
    mapping: {
      adsCustomerId: null,
      ga4PropertyId: null,
      gtmContainerId: null,
      gscSiteUrl: null,
      merchantId: null,
    },
  },
];

async function upsertTenant(t: SeedTenant) {
  const tenant = await prisma.tenant.upsert({
    where: { metaAccountId: t.metaAccountId },
    update: {
      slug: t.slug,
      name: t.name,
      website: t.website,
      type: t.type,
      monthlyBudget: t.monthlyBudget,
      timezone: "Europe/Istanbul",
      currency: "TRY",
      visible: true,
    },
    create: {
      slug: t.slug,
      name: t.name,
      website: t.website,
      metaAccountId: t.metaAccountId,
      type: t.type,
      monthlyBudget: t.monthlyBudget,
      timezone: "Europe/Istanbul",
      currency: "TRY",
      visible: true,
      mapping: { create: { ...t.mapping } },
      thresholds: { create: {} },
    },
  });

  await prisma.tenantMapping.upsert({
    where: { tenantId: tenant.id },
    update: { ...t.mapping },
    create: { tenantId: tenant.id, ...t.mapping },
  });

  await prisma.tenantThreshold.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  // Placeholder sync jobs per metric group (unknown until live/mock fill).
  const jobs: Array<{
    provider: "meta" | "google";
    service: string;
    objective: string;
  }> = [
    { provider: "meta", service: "insights", objective: "campaign_daily" },
    { provider: "google", service: "ads", objective: "campaign_daily" },
    { provider: "google", service: "ga4", objective: "overview" },
    { provider: "google", service: "gtm", objective: "config" },
  ];
  if (t.mapping.gscSiteUrl) {
    jobs.push({ provider: "google", service: "gsc", objective: "query" });
  }
  if (t.type === "ecommerce" && t.mapping.merchantId) {
    jobs.push({
      provider: "google",
      service: "merchant",
      objective: "product_status",
    });
  }

  for (const j of jobs) {
    await prisma.syncJob.upsert({
      where: {
        tenantId_provider_service_objective: {
          tenantId: tenant.id,
          provider: j.provider,
          service: j.service,
          objective: j.objective,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        provider: j.provider,
        service: j.service,
        objective: j.objective,
        status: "pending",
      },
    });
  }

  return tenant;
}

async function main() {
  await prisma.agencyConnection.upsert({
    where: { provider: "meta" },
    update: {
      oauthTokenRef: "env:META_SYSTEM_USER_TOKEN",
      businessId: process.env.META_BUSINESS_ID || null,
    },
    create: {
      provider: "meta",
      oauthTokenRef: "env:META_SYSTEM_USER_TOKEN",
      businessId: process.env.META_BUSINESS_ID || null,
    },
  });

  await prisma.agencyConnection.upsert({
    where: { provider: "google" },
    update: {
      oauthTokenRef: "env:GOOGLE_REFRESH_TOKEN",
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null,
    },
    create: {
      provider: "google",
      oauthTokenRef: "env:GOOGLE_REFRESH_TOKEN",
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null,
    },
  });

  const tenants = [];
  for (const t of SEED_TENANTS) {
    tenants.push(await upsertTenant(t));
  }

  const adminHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@593emarketing.com" },
    update: { passwordHash: adminHash, role: "admin", name: "593 Admin" },
    create: {
      email: "admin@593emarketing.com",
      passwordHash: adminHash,
      name: "593 Admin",
      role: "admin",
    },
  });

  const mareen = tenants.find((t) => t.slug === "mareen")!;
  const demo = tenants.find((t) => t.slug === "demo")!;

  const clientHash = await bcrypt.hash("client1234", 10);
  const mareenClient = await prisma.user.upsert({
    where: { email: "musteri@mareen.com" },
    update: {
      passwordHash: clientHash,
      role: "client",
      name: "MAREEN Müşteri",
    },
    create: {
      email: "musteri@mareen.com",
      passwordHash: clientHash,
      name: "MAREEN Müşteri",
      role: "client",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_tenantId: { userId: mareenClient.id, tenantId: mareen.id },
    },
    update: {},
    create: { userId: mareenClient.id, tenantId: mareen.id },
  });

  const leadHash = await bcrypt.hash("lead1234", 10);
  const leadClient = await prisma.user.upsert({
    where: { email: "musteri@demo.com" },
    update: {
      passwordHash: leadHash,
      role: "client",
      name: "Demo Lead Müşteri",
    },
    create: {
      email: "musteri@demo.com",
      passwordHash: leadHash,
      name: "Demo Lead Müşteri",
      role: "client",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_tenantId: { userId: leadClient.id, tenantId: demo.id },
    },
    update: {},
    create: { userId: leadClient.id, tenantId: demo.id },
  });

  console.log(
    "Seed OK:",
    `mareen(${mareen.type})`,
    `demo(${demo.type})`,
    "admin@593emarketing.com / demo1234",
    "musteri@mareen.com / client1234",
    "musteri@demo.com / lead1234",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
