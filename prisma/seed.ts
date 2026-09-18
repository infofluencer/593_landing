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
  const admin = await prisma.user.upsert({
    where: { email: "admin@593emarketing.com" },
    update: { passwordHash: adminHash, role: "admin", name: "593 Admin" },
    create: {
      email: "admin@593emarketing.com",
      passwordHash: adminHash,
      name: "593 Admin",
      role: "admin",
    },
  });

  const teamHash = await bcrypt.hash("team1234", 10);
  const teamUser = await prisma.user.upsert({
    where: { email: "team@593emarketing.com" },
    update: {
      passwordHash: teamHash,
      role: "team",
      name: "593 Team",
      passwordPlain: "team1234",
    },
    create: {
      email: "team@593emarketing.com",
      passwordHash: teamHash,
      passwordPlain: "team1234",
      name: "593 Team",
      role: "team",
    },
  });

  const DEFAULT_TEAMS: Array<{
    name: string;
    description: string;
    color: string;
  }> = [
    { name: "Meta", description: "Meta reklam operasyonları", color: "#0866FF" },
    { name: "Google", description: "Google Ads & Search", color: "#4285F4" },
    { name: "Analytics", description: "GA4, GTM, ölçümleme", color: "#E37400" },
    { name: "Kreatif", description: "Kreatif ve içerik üretimi", color: "#7C3AED" },
    {
      name: "Hesap yönetimi",
      description: "Müşteri ilişkileri ve hesap yönetimi",
      color: "#0D9488",
    },
  ];

  const staffIds = [admin.id, teamUser.id];
  for (const def of DEFAULT_TEAMS) {
    const slug = def.name
      .toLocaleLowerCase("tr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const team =
      (await prisma.team.findFirst({
        where: { OR: [{ name: def.name }, { slug }] },
      })) ??
      (await prisma.team.create({
        data: {
          name: def.name,
          slug,
          color: def.color,
          description: def.description,
        },
      }));

    await prisma.team.update({
      where: { id: team.id },
      data: {
        description: def.description,
        color: def.color,
        slug: team.slug || slug,
        name: def.name,
      },
    });

    for (const userId of staffIds) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId } },
        update: {},
        create: { teamId: team.id, userId },
      });
    }
  }

  const boardCount = await prisma.board.count();
  if (boardCount === 0) {
    await prisma.board.create({
      data: {
        name: "Ajans durumu",
        columns: {
          create: [
            { name: "Yapılacak", color: "#71717a", position: 0 },
            { name: "Devam ediyor", color: "#2563eb", position: 1 },
            { name: "İncelemede", color: "#d97706", position: 2 },
            { name: "Tamamlandı", color: "#16a34a", position: 3 },
          ],
        },
      },
    });
  }

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
    "admin@593emarketing.com / demo1234 → admin.localhost:3006",
    "team@593emarketing.com / team1234 → admin.localhost:3006",
    "musteri@mareen.com / client1234 → mareen.localhost:3006",
    "musteri@demo.com / lead1234 → demo.localhost:3006",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
