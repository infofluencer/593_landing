import { Prisma, type Provider } from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getIstanbulTodayYmd } from "@/lib/date/now";
import {
  formatYmdTr,
  isValidYmd,
  subMonthsYmd,
  ymdToUtcDate,
} from "@/lib/date/tr";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type BudgetProvider = "google" | "meta";

export type BudgetCampaignRow = {
  provider: BudgetProvider;
  campaignId: string;
  /** API'den gelen orijinal ad */
  campaignName: string;
  /** Kullanıcının verdiği görünen ad */
  label: string | null;
  audience: string | null;
  location: string | null;
  monthlyBudget: number | null;
  dailyBudget: number | null;
  monthSpend: number;
  todaySpend: number;
  /** Seçilen dönemde gün başına ortalama harcama */
  avgDailySpend: number;
};

export function utcDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function inclusiveDayCount(from: string, to: string): number {
  if (from > to) return 0;
  const start = ymdToUtcDate(from);
  const end = ymdToUtcDate(to);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function displayCampaignName(row: {
  campaignName: string;
  label?: string | null;
}): string {
  const label = row.label?.trim();
  return label || row.campaignName;
}

export type BudgetProviderSummary = {
  provider: BudgetProvider;
  plannedMonthly: number;
  plannedDaily: number;
  monthSpend: number;
  todaySpend: number;
};

export type BudgetSummary = {
  plannedMonthly: number | null;
  plannedDaily: number | null;
  campaignMonthly: number;
  campaignDaily: number;
  monthSpend: number;
  todaySpend: number;
  remaining: number | null;
  pacePct: number | null;
  google: BudgetProviderSummary;
  meta: BudgetProviderSummary;
};

export function summarizeBudgetPlan(
  brand: { monthlyBudget: number | null; dailyBudget: number | null },
  campaigns: Array<{
    provider: BudgetProvider;
    monthlyBudget: number | null;
    dailyBudget: number | null;
    monthSpend: number;
    todaySpend: number;
  }>,
): BudgetSummary {
  const empty = (): BudgetProviderSummary => ({
    provider: "google",
    plannedMonthly: 0,
    plannedDaily: 0,
    monthSpend: 0,
    todaySpend: 0,
  });
  const google: BudgetProviderSummary = { ...empty(), provider: "google" };
  const meta: BudgetProviderSummary = { ...empty(), provider: "meta" };

  let campaignMonthly = 0;
  let campaignDaily = 0;
  let monthSpend = 0;
  let todaySpend = 0;

  for (const row of campaigns) {
    const monthly = row.monthlyBudget ?? 0;
    const daily = row.dailyBudget ?? 0;
    campaignMonthly += monthly;
    campaignDaily += daily;
    monthSpend += row.monthSpend;
    todaySpend += row.todaySpend;
    const bucket = row.provider === "meta" ? meta : google;
    bucket.plannedMonthly += monthly;
    bucket.plannedDaily += daily;
    bucket.monthSpend += row.monthSpend;
    bucket.todaySpend += row.todaySpend;
  }

  const plannedMonthly = brand.monthlyBudget ?? (campaignMonthly || null);
  const plannedDaily = brand.dailyBudget ?? (campaignDaily || null);
  const pacePct =
    plannedMonthly && plannedMonthly > 0
      ? Math.round((monthSpend / plannedMonthly) * 100)
      : null;

  return {
    plannedMonthly,
    plannedDaily,
    campaignMonthly,
    campaignDaily,
    monthSpend,
    todaySpend,
    remaining:
      plannedMonthly != null ? Math.max(0, plannedMonthly - monthSpend) : null,
    pacePct,
    google,
    meta,
  };
}

export function budgetPacePct(
  realized: number,
  planned: number | null,
): number | null {
  if (planned == null || planned <= 0) return null;
  return Math.round((realized / planned) * 100);
}

export type BrandBudgetPlan = {
  tenantId: string;
  slug: string;
  name: string;
  currency: string;
  existsInDb: true;
  /** Planın yazıldığı / düzenlenen ay (YYYY-MM). */
  month: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  monthStart: string;
  monthEnd: string;
  rangeFrom: string;
  rangeTo: string;
  rangeLabel: string;
  months: string[];
  canEdit: boolean;
  today: string;
  isCurrentMonth: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  daysElapsed: number;
  warnPct: number;
  brand: {
    monthlyBudget: number | null;
    dailyBudget: number | null;
  };
  /** Seçilen dönemdeki ayların plan toplamı (inceleme). */
  rangeBrand: {
    monthlyBudget: number | null;
    dailyBudget: number | null;
  };
  campaigns: BudgetCampaignRow[];
};

export type LoadBudgetOpts = {
  month?: string | null;
  from?: string | null;
  to?: string | null;
};

export function monthsInYmdRange(from: string, to: string): string[] {
  if (from > to) return [];
  const months: string[] = [];
  let cursor = from.slice(0, 7);
  const end = to.slice(0, 7);
  while (cursor <= end) {
    months.push(cursor);
    cursor = shiftBudgetMonth(cursor, 1);
  }
  return months;
}

export function isValidBudgetMonth(month: string): boolean {
  return MONTH_RE.test(month);
}

export function currentBudgetMonth(todayYmd: string): string {
  return todayYmd.slice(0, 7);
}

export function shiftBudgetMonth(month: string, delta: number): string {
  const ymd = `${month}-01`;
  return subMonthsYmd(ymd, -delta).slice(0, 7);
}

export function endOfMonthYmd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function formatBudgetMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(`${month}-01T12:00:00+03:00`));
}

function asMoney(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function campaignKey(provider: BudgetProvider, campaignId: string): string {
  return `${provider}:${campaignId}`;
}

function normalizeLoadOpts(
  opts?: string | null | LoadBudgetOpts,
): LoadBudgetOpts {
  if (opts == null) return {};
  if (typeof opts === "string") return { month: opts };
  return opts;
}

export async function loadBrandBudgetPlan(
  slug: string,
  opts?: string | null | LoadBudgetOpts,
): Promise<BrandBudgetPlan | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      currency: true,
      thresholds: { select: { budgetPaceWarnPct: true } },
    },
  });
  if (!tenant) return null;

  const today = await getIstanbulTodayYmd();
  const current = currentBudgetMonth(today);
  const parsed = normalizeLoadOpts(opts);

  const rangeFrom =
    parsed.from && isValidYmd(parsed.from) ? parsed.from : `${current}-01`;
  const rangeTo = parsed.to && isValidYmd(parsed.to) ? parsed.to : today;
  const from = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
  const to = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
  const months = monthsInYmdRange(from, to);

  const month =
    parsed.month && isValidBudgetMonth(parsed.month)
      ? parsed.month
      : months.length === 1
        ? months[0]
        : months.includes(current)
          ? current
          : (months[months.length - 1] ?? current);

  const monthStart = `${month}-01`;
  const monthEnd = endOfMonthYmd(month);
  const recentFrom = subMonthsYmd(today, 1);
  const listingFrom =
    months.some((m) => m >= current) && recentFrom < from ? recentFrom : from;
  const listingTo = to > today ? today : to;

  const fromDate = ymdToUtcDate(listingFrom);
  const toDate = ymdToUtcDate(listingTo);
  const spendFrom = ymdToUtcDate(from);
  const spendTo = ymdToUtcDate(to);

  const [googleRows, metaRows, brandRows, campaignRows, aliases] =
    await Promise.all([
    prisma.googleAdsMetric.findMany({
      where: { tenantId: tenant.id, date: { gte: fromDate, lte: toDate } },
      select: {
        campaignId: true,
        campaignName: true,
        date: true,
        cost: true,
      },
    }),
    prisma.metaInsight.findMany({
      where: { tenantId: tenant.id, date: { gte: fromDate, lte: toDate } },
      select: {
        campaignId: true,
        campaignName: true,
        date: true,
        spend: true,
      },
    }),
    listTenantBudgets(tenant.id, months),
    listCampaignBudgets(tenant.id, months),
    listCampaignAliases(tenant.id),
  ]);

  const map = new Map<string, BudgetCampaignRow>();

  function touch(
    provider: BudgetProvider,
    campaignId: string,
    campaignName: string,
  ) {
    const id = campaignId.trim();
    if (!id) return;
    const key = campaignKey(provider, id);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        provider,
        campaignId: id,
        campaignName: campaignName.trim() || id,
        label: null,
        audience: null,
        location: null,
        monthlyBudget: null,
        dailyBudget: null,
        monthSpend: 0,
        todaySpend: 0,
        avgDailySpend: 0,
      });
      return;
    }
    if (campaignName.trim()) prev.campaignName = campaignName.trim();
  }

  function addSpend(
    provider: BudgetProvider,
    campaignId: string,
    campaignName: string,
    date: Date,
    amount: number,
  ) {
    const id = campaignId.trim();
    if (!id) return;
    touch(provider, id, campaignName);
    const row = map.get(campaignKey(provider, id));
    if (!row || !Number.isFinite(amount)) return;
    if (date >= spendFrom && date <= spendTo) {
      row.monthSpend += amount;
      if (utcDateYmd(date) === today) {
        row.todaySpend += amount;
      }
    }
  }

  for (const row of googleRows) {
    addSpend(
      "google",
      row.campaignId,
      row.campaignName,
      row.date,
      Number(row.cost),
    );
  }
  for (const row of metaRows) {
    addSpend("meta", row.campaignId, row.campaignName, row.date, Number(row.spend));
  }
  for (const row of campaignRows) {
    const provider = row.provider as BudgetProvider;
    touch(provider, row.campaignId, row.campaignName);
    const existing = map.get(campaignKey(provider, row.campaignId.trim()));
    if (!existing) continue;
    const monthly = asMoney(row.monthlyBudget);
    const daily = asMoney(row.dailyBudget);
    if (monthly != null) {
      existing.monthlyBudget = (existing.monthlyBudget ?? 0) + monthly;
    }
    if (daily != null) {
      existing.dailyBudget = (existing.dailyBudget ?? 0) + daily;
    }
    if (row.campaignName.trim()) existing.campaignName = row.campaignName.trim();
  }
  for (const alias of aliases) {
    const provider = alias.provider as BudgetProvider;
    touch(provider, alias.campaignId, alias.sourceName);
    const existing = map.get(campaignKey(provider, alias.campaignId.trim()));
    if (!existing) continue;
    existing.label = alias.label.trim() || null;
    existing.audience = alias.audience.trim() || null;
    existing.location = alias.location.trim() || null;
    if (alias.sourceName.trim() && !existing.campaignName) {
      existing.campaignName = alias.sourceName.trim();
    }
  }

  const elapsedTo = to < today ? to : today < from ? from : today;
  const daysElapsed = Math.max(1, inclusiveDayCount(from, elapsedTo));
  const campaigns = [...map.values()]
    .map((row) => ({
      ...row,
      avgDailySpend: row.monthSpend / daysElapsed,
    }))
    .sort((a, b) => {
      if (b.monthSpend !== a.monthSpend) return b.monthSpend - a.monthSpend;
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.campaignName.localeCompare(b.campaignName, "tr");
    });

  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = Number(monthEnd.slice(8, 10));
  const focusBrand = brandRows.find((row) => row.month === month);
  const rangeMonthly = brandRows.reduce(
    (sum, row) => sum + (asMoney(row.monthlyBudget) ?? 0),
    0,
  );
  const rangeDaily = brandRows.reduce(
    (sum, row) => sum + (asMoney(row.dailyBudget) ?? 0),
    0,
  );

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    currency: tenant.currency,
    existsInDb: true,
    month,
    monthLabel: formatBudgetMonthLabel(month),
    prevMonth: shiftBudgetMonth(month, -1),
    nextMonth: shiftBudgetMonth(month, 1),
    monthStart,
    monthEnd,
    rangeFrom: from,
    rangeTo: to,
    rangeLabel: `${formatYmdTr(from)} – ${formatYmdTr(to)}`,
    months,
    canEdit: months.length === 1,
    today,
    isCurrentMonth: from <= today && today <= to,
    dayOfMonth: month === current ? dayOfMonth : daysInMonth,
    daysInMonth,
    daysElapsed,
    warnPct: tenant.thresholds?.budgetPaceWarnPct ?? 85,
    brand: {
      monthlyBudget: asMoney(focusBrand?.monthlyBudget),
      dailyBudget: asMoney(focusBrand?.dailyBudget),
    },
    rangeBrand: {
      monthlyBudget: rangeMonthly > 0 ? rangeMonthly : null,
      dailyBudget: rangeDaily > 0 ? rangeDaily : null,
    },
    campaigns,
  };
}

export type SaveBrandBudgetInput = {
  month: string;
  monthlyBudget: number | null;
  dailyBudget: number | null;
  campaigns: Array<{
    provider: BudgetProvider;
    campaignId: string;
    campaignName?: string;
    label?: string | null;
    audience?: string | null;
    location?: string | null;
    monthlyBudget: number | null;
    dailyBudget: number | null;
  }>;
  removeCampaigns?: Array<{
    provider: BudgetProvider;
    campaignId: string;
  }>;
};

export function isManualCampaignId(campaignId: string): boolean {
  return campaignId.startsWith("manual_");
}

export async function tenantHasBudgetPlan(
  tenantId: string,
  month?: string,
): Promise<boolean> {
  const today = await getIstanbulTodayYmd();
  const m = month && isValidBudgetMonth(month) ? month : currentBudgetMonth(today);
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT (
      (SELECT COUNT(*)::int FROM "TenantBudget" WHERE "tenantId" = ${tenantId} AND month = ${m})
      +
      (SELECT COUNT(*)::int FROM "CampaignBudget" WHERE "tenantId" = ${tenantId} AND month = ${m})
    ) AS n
  `;
  return (rows[0]?.n ?? 0) > 0;
}

export function parseBudgetAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Bütçe 0 veya pozitif olmalı");
    }
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") {
    throw new Error("Geçersiz bütçe");
  }
  const raw = value.trim();
  if (raw === "") return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    : raw.replace(/\s/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Bütçe 0 veya pozitif olmalı");
  }
  return Math.round(n * 100) / 100;
}

export async function saveBrandBudgetPlan(
  tenantId: string,
  input: SaveBrandBudgetInput,
) {
  if (!isValidBudgetMonth(input.month)) {
    throw new Error("Ay YYYY-MM olmalı");
  }

  const campaigns = input.campaigns
    .map((row) => {
      const campaignId = row.campaignId.trim();
      if (!campaignId) return null;
      if (row.provider !== "google" && row.provider !== "meta") return null;
      return {
        provider: row.provider as Provider,
        campaignId,
        campaignName: (row.campaignName ?? "").trim(),
        label: (row.label ?? "").trim(),
        audience: (row.audience ?? "").trim(),
        location: (row.location ?? "").trim(),
        monthlyBudget: row.monthlyBudget,
        dailyBudget: row.dailyBudget,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const removals = (input.removeCampaigns ?? [])
    .map((row) => ({
      provider: row.provider,
      campaignId: row.campaignId.trim(),
    }))
    .filter(
      (row) =>
        row.campaignId &&
        (row.provider === "google" || row.provider === "meta") &&
        isManualCampaignId(row.campaignId),
    );

  await prisma.$transaction(async (tx) => {
    const brandEmpty =
      input.monthlyBudget == null && input.dailyBudget == null;
    if (brandEmpty) {
      await tx.$executeRaw`
        DELETE FROM "TenantBudget"
        WHERE "tenantId" = ${tenantId} AND month = ${input.month}
      `;
    } else {
      await upsertTenantBudget(tx, {
        tenantId,
        month: input.month,
        monthlyBudget: input.monthlyBudget,
        dailyBudget: input.dailyBudget,
      });
    }

    for (const row of campaigns) {
      const empty = row.monthlyBudget == null && row.dailyBudget == null;
      if (empty) {
        await tx.$executeRaw`
          DELETE FROM "CampaignBudget"
          WHERE "tenantId" = ${tenantId}
            AND month = ${input.month}
            AND provider = ${row.provider}::"Provider"
            AND "campaignId" = ${row.campaignId}
        `;
        continue;
      }
      await upsertCampaignBudget(tx, {
        tenantId,
        month: input.month,
        provider: row.provider,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        monthlyBudget: row.monthlyBudget,
        dailyBudget: row.dailyBudget,
      });
    }

    for (const row of removals) {
      await tx.$executeRaw`
        DELETE FROM "CampaignBudget"
        WHERE "tenantId" = ${tenantId}
          AND provider = ${row.provider}::"Provider"
          AND "campaignId" = ${row.campaignId}
      `;
      await tx.$executeRaw`
        DELETE FROM "CampaignAlias"
        WHERE "tenantId" = ${tenantId}
          AND provider = ${row.provider}::"Provider"
          AND "campaignId" = ${row.campaignId}
      `;
    }

    for (const row of campaigns) {
      const keepAlias =
        Boolean(row.label || row.audience || row.location) ||
        isManualCampaignId(row.campaignId);
      if (keepAlias) {
        await upsertCampaignAlias(tx, {
          tenantId,
          provider: row.provider,
          campaignId: row.campaignId,
          label: row.label || row.campaignName,
          sourceName: row.campaignName || row.label,
          audience: row.audience,
          location: row.location,
        });
      } else {
        await tx.$executeRaw`
          DELETE FROM "CampaignAlias"
          WHERE "tenantId" = ${tenantId}
            AND provider = ${row.provider}::"Provider"
            AND "campaignId" = ${row.campaignId}
        `;
      }
    }
  });
}

type BudgetSqlClient = {
  $queryRaw: typeof prisma.$queryRaw;
  $executeRaw: typeof prisma.$executeRaw;
};

type TenantBudgetRow = {
  id: string;
  tenantId: string;
  month: string;
  monthlyBudget: unknown;
  dailyBudget: unknown;
};

type CampaignBudgetRow = {
  id: string;
  tenantId: string;
  month: string;
  provider: Provider;
  campaignId: string;
  campaignName: string;
  monthlyBudget: unknown;
  dailyBudget: unknown;
};

function newCuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

async function listTenantBudgets(
  tenantId: string,
  months: string[],
): Promise<TenantBudgetRow[]> {
  if (months.length === 0) return [];
  return prisma.$queryRaw<TenantBudgetRow[]>`
    SELECT id, "tenantId", month, "monthlyBudget", "dailyBudget"
    FROM "TenantBudget"
    WHERE "tenantId" = ${tenantId}
      AND month IN (${Prisma.join(months)})
  `;
}

type CampaignAliasRow = {
  provider: Provider;
  campaignId: string;
  label: string;
  sourceName: string;
  audience: string;
  location: string;
};

async function listCampaignAliases(
  tenantId: string,
): Promise<CampaignAliasRow[]> {
  return prisma.$queryRaw<CampaignAliasRow[]>`
    SELECT provider, "campaignId", label, "sourceName", audience, location
    FROM "CampaignAlias"
    WHERE "tenantId" = ${tenantId}
  `;
}

async function listCampaignBudgets(
  tenantId: string,
  months: string[],
): Promise<CampaignBudgetRow[]> {
  if (months.length === 0) return [];
  return prisma.$queryRaw<CampaignBudgetRow[]>`
    SELECT id, "tenantId", month, provider, "campaignId", "campaignName",
           "monthlyBudget", "dailyBudget"
    FROM "CampaignBudget"
    WHERE "tenantId" = ${tenantId}
      AND month IN (${Prisma.join(months)})
  `;
}

async function upsertTenantBudget(
  db: BudgetSqlClient,
  row: {
    tenantId: string;
    month: string;
    monthlyBudget: number | null;
    dailyBudget: number | null;
  },
) {
  await db.$executeRaw`
    INSERT INTO "TenantBudget"
      (id, "tenantId", month, "monthlyBudget", "dailyBudget", "createdAt", "updatedAt")
    VALUES
      (${newCuidLike()}, ${row.tenantId}, ${row.month}, ${row.monthlyBudget}, ${row.dailyBudget}, NOW(), NOW())
    ON CONFLICT ("tenantId", month)
    DO UPDATE SET
      "monthlyBudget" = EXCLUDED."monthlyBudget",
      "dailyBudget" = EXCLUDED."dailyBudget",
      "updatedAt" = NOW()
  `;
}

async function upsertCampaignBudget(
  db: BudgetSqlClient,
  row: {
    tenantId: string;
    month: string;
    provider: Provider;
    campaignId: string;
    campaignName: string;
    monthlyBudget: number | null;
    dailyBudget: number | null;
  },
) {
  await db.$executeRaw`
    INSERT INTO "CampaignBudget"
      (id, "tenantId", month, provider, "campaignId", "campaignName",
       "monthlyBudget", "dailyBudget", "createdAt", "updatedAt")
    VALUES
      (${newCuidLike()}, ${row.tenantId}, ${row.month}, ${row.provider}::"Provider",
       ${row.campaignId}, ${row.campaignName}, ${row.monthlyBudget}, ${row.dailyBudget},
       NOW(), NOW())
    ON CONFLICT ("tenantId", month, provider, "campaignId")
    DO UPDATE SET
      "campaignName" = COALESCE(NULLIF(EXCLUDED."campaignName", ''), "CampaignBudget"."campaignName"),
      "monthlyBudget" = EXCLUDED."monthlyBudget",
      "dailyBudget" = EXCLUDED."dailyBudget",
      "updatedAt" = NOW()
  `;
}

async function upsertCampaignAlias(
  db: BudgetSqlClient,
  row: {
    tenantId: string;
    provider: Provider;
    campaignId: string;
    label: string;
    sourceName: string;
    audience: string;
    location: string;
  },
) {
  await db.$executeRaw`
    INSERT INTO "CampaignAlias"
      (id, "tenantId", provider, "campaignId", label, "sourceName",
       audience, location, "createdAt", "updatedAt")
    VALUES
      (${newCuidLike()}, ${row.tenantId}, ${row.provider}::"Provider",
       ${row.campaignId}, ${row.label}, ${row.sourceName},
       ${row.audience}, ${row.location}, NOW(), NOW())
    ON CONFLICT ("tenantId", provider, "campaignId")
    DO UPDATE SET
      label = EXCLUDED.label,
      "sourceName" = COALESCE(NULLIF(EXCLUDED."sourceName", ''), "CampaignAlias"."sourceName"),
      audience = EXCLUDED.audience,
      location = EXCLUDED.location,
      "updatedAt" = NOW()
  `;
}
