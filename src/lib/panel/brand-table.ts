import type { AlertSeverity, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getIstanbulTodayYmd } from "@/lib/date/now";
import { ymdToUtcDate } from "@/lib/date/tr";
import { currentBudgetMonth, endOfMonthYmd } from "@/lib/panel/brand-budget";
import {
  computeBudgetPacing,
  PACE_STATUS_META,
  type BudgetPaceStatus,
  type PaceTone,
} from "@/lib/panel/budget-pacing";
import { listAgencyBrands } from "@/lib/panel/data";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { hourlyDateFor } from "@/lib/panel/hourly-sync";
import { withoutDisabledJobs } from "@/lib/panel/integrations";
import { resolveMetaAccountId } from "@/lib/panel/meta-ad-account-map";
// Hook değil — rules-of-hooks yanlış alarmını önlemek için takma ad.
import { useMockPanelData as isMockPanelData } from "@/lib/integrations/tokens";

/** Bu kadar tam gün (bugün hariç) harcama yoksa "harcama durdu". */
export const SPEND_STOP_DAYS = 2;

function daysBetween(fromYmd: string, toYmd: string): number {
  const ms = (ymd: string) =>
    Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  return Math.round((ms(toYmd) - ms(fromYmd)) / 86_400_000);
}

function dmy(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(0, 4)}`;
}

/** Senkron bu kadar saatten eskiyse "gecikmiş" sayılır. */
export const SYNC_STALE_HOURS = 24;

export type TokenState = "ok" | "token" | "permission" | "none";

export type BrandReason = { tone: PaceTone; text: string };

export type BrandTableRow = {
  slug: string;
  name: string;
  coverUrl: string | null;
  health: AlertSeverity | null;
  /** Öncelik sırasına göre (kritik önce) — ilki "durum sebebi" olarak gösterilir. */
  reasons: BrandReason[];
  currency: string;
  planned: number | null;
  spent: number;
  paceStatus: BudgetPaceStatus;
  /** Ay sonu tahmini / plan (yüzde). */
  projectedPct: number | null;
  /** Kapanmış günlere göre bugüne kadar harcanmış olması gereken. */
  expectedToDate: number | null;
  avgDaily: number | null;
  recommendedDaily: number | null;
  projected: number | null;
  /** Kanal kırılımı — plan yalnızca marka seviyesinde kanal payı girildiyse. */
  channels: {
    meta: { spent: number; planned: number | null };
    google: { spent: number; planned: number | null };
  };
  /** Ay başından bugüne günlük harcama (eksik günler 0). */
  daily: DailySpend[];
  /** Bugün saat saat (0–23) — saatlik senkrondan; veri yoksa boş dizi. */
  hourly: HourlyPoint[];
  /** Bugünkü harcama (saatlik veri varsa ondan, yoksa günlük tablodan). */
  todaySpend: number;
  /**
   * Markanın kullandığı tüm kanallar için bugünün saatlik verisi çekildi mi.
   * Bir kanal eksikse 0 harcama "harcama yok" sayılmaz.
   */
  hourlyFetched: boolean;
  /** Kanal bazında bugünkü durum: n/a = eşleşme yok (kanal kullanılmıyor). */
  todayByProvider: {
    meta: ProviderToday;
    google: ProviderToday;
  };
  /** Reklam hesabı / ödeme durumu (saatlik kontrol). */
  accounts: { meta: AccountState | null; google: AccountState | null };
  /** Harcama olan son gün (tüm zamanlar, YYYY-MM-DD). */
  lastSpendDate: string | null;
  /** Bugün hariç kaç gündür harcama yok (lastSpendDate'ten). */
  spendStoppedDays: number | null;
  lastSyncAt: string | null;
  /** Hiç senkron yok veya SYNC_STALE_HOURS'tan eski. */
  syncStale: boolean;
  tokens: { meta: TokenState; google: TokenState };
  owner: { id: string; label: string } | null;
};

export type DailySpend = { date: string; meta: number; google: number };

export type HourlyPoint = { hour: number; meta: number; google: number };

export type ProviderToday = {
  state: "ok" | "error" | "missing" | "n/a";
  spend: number;
  error: string | null;
};

export type AccountState = {
  status: "ok" | "warn" | "critical" | "unknown";
  label: string;
  detail: string | null;
  checkedAt: string;
};

export type BrandTableData = {
  month: string;
  today: string;
  daysInMonth: number;
  /** İstanbul saatiyle şu anki saat (0–23) — "bugün henüz harcama yok" eşiği için. */
  currentHour: number;
  rows: BrandTableRow[];
};

/** Hata metni → sınıf. Gerçek SyncJob.error örneklerine göre. */
export function classifySyncError(
  error: string | null,
): "token" | "permission" | "setup" | "rate" | "other" {
  const e = error ?? "";
  if (/OAuth eksik|access token|authentication credential|invalid_grant|Error validating access token|session has expired|code.?190|\(#190\)/i.test(e))
    return "token";
  if (/\(#200\)|permission|not grant|PERMISSION_DENIED|yetki/i.test(e))
    return "permission";
  if (/eksik|yok —|eşleştirilmemiş|has not been used|is disabled|tanımlı değil/i.test(e))
    return "setup";
  if (/limit reached|rate limit|429|quota/i.test(e)) return "rate";
  return "other";
}

const SERVICE_LABEL: Record<string, string> = {
  insights: "Meta kampanya",
  ad_insights: "Meta reklam",
  ads: "Reklam",
  billing: "Fatura",
  ga4: "GA4",
  gtm: "GTM",
  gsc: "Search Console",
  merchant: "Merchant",
};

function serviceLabel(provider: string, service: string): string {
  if (service === "ads") return provider === "meta" ? "Meta kreatif" : "Google Ads";
  return SERVICE_LABEL[service] ?? service;
}

/** Sentinel / kilit satırları — gerçek API çağrısı değil. */
const META_SERVICES = new Set(["panel_sync", "cron", "backfill"]);

/** alerts-engine'in job / eşleşme kaynaklı alarm tipleri. */
const DERIVED_ALERT = /^(missing_mapping|sync_error|payment_)/;

/** Bu saatten sonra bugün hâlâ harcama yoksa uyarı (gece saatleri gürültü olmasın). */
const TODAY_NO_SPEND_HOUR = 10;

const REASON_MAX = 90;

function shorten(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > REASON_MAX ? `${t.slice(0, REASON_MAX - 1)}…` : t;
}

const TONE_RANK: Record<PaceTone, number> = {
  critical: 0,
  warn: 1,
  muted: 2,
  ok: 3,
};

type SpendRow = {
  tenantId: string;
  date: string;
  google: number;
  meta: number;
};

function monthDays(month: string, today: string): string[] {
  const last = endOfMonthYmd(month);
  const end = today < last ? today : last;
  const out: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const ymd = `${month}-${String(d).padStart(2, "0")}`;
    if (ymd > end) break;
    out.push(ymd);
  }
  return out;
}

export async function loadBrandTable(opts: {
  role: Role;
  tenantIds: string[];
  hostSlug: string;
  visible: boolean;
}): Promise<BrandTableData> {
  const today = await getIstanbulTodayYmd();
  const month = currentBudgetMonth(today);
  const daysInMonth = Number(endOfMonthYmd(month).slice(8, 10));
  const currentHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const cards = await listAgencyBrands(opts);
  const emptyChannels = () => ({
    meta: { spent: 0, planned: null },
    google: { spent: 0, planned: null },
  });

  if (isMockPanelData()) {
    return {
      month,
      today,
      daysInMonth,
      currentHour,
      rows: cards.map((c) => ({
        slug: c.slug,
        name: c.name,
        coverUrl: c.coverUrl,
        health: c.health,
        reasons: [],
        currency: "TRY",
        planned: null,
        spent: 0,
        paceStatus: "none",
        projectedPct: null,
        expectedToDate: null,
        avgDaily: null,
        recommendedDaily: null,
        projected: null,
        channels: emptyChannels(),
        daily: [],
        hourly: [],
        todaySpend: 0,
        hourlyFetched: false,
        todayByProvider: {
          meta: { state: "n/a", spend: 0, error: null },
          google: { state: "n/a", spend: 0, error: null },
        },
        accounts: { meta: null, google: null },
        lastSpendDate: null,
        spendStoppedDays: null,
        lastSyncAt: null,
        syncStale: false,
        tokens: { meta: "none", google: "none" },
        owner: null,
      })),
    };
  }

  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: cards.map((c) => c.slug) } },
    select: {
      id: true,
      slug: true,
      name: true,
      currency: true,
      timezone: true,
      metaAccountId: true,
      disabledIntegrations: true,
      mapping: { select: { adsCustomerId: true, ga4PropertyId: true, adsTimezone: true } },
      owner: { select: { id: true, name: true, email: true } },
      syncJobs: {
        select: {
          provider: true,
          service: true,
          status: true,
          error: true,
          lastSuccessAt: true,
        },
      },
      alerts: {
        where: { resolved: false },
        select: { severity: true, message: true, type: true },
      },
    },
  });
  const ids = tenants.map((t) => t.id);
  const monthStart = ymdToUtcDate(`${month}-01`);
  const monthEnd = ymdToUtcDate(endOfMonthYmd(month));

  const [budgets, campaignBudgets, spendRows, lastSpendRows, hourlyRows, healthRows] = ids.length
    ? await Promise.all([
        prisma.tenantBudget.findMany({
          where: { tenantId: { in: ids }, month },
          select: {
            tenantId: true,
            monthlyBudget: true,
            googleBudget: true,
            metaBudget: true,
          },
        }),
        prisma.campaignBudget.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: ids }, month },
          _sum: { monthlyBudget: true },
        }),
        prisma.$queryRaw<SpendRow[]>`
          SELECT "tenantId", to_char(date, 'YYYY-MM-DD') AS date,
                 SUM(google)::float8 AS google, SUM(meta)::float8 AS meta
          FROM (
            SELECT "tenantId", date, cost AS google, 0::numeric AS meta FROM "GoogleAdsMetric"
            WHERE "tenantId" = ANY(${ids}) AND date >= ${monthStart} AND date <= ${monthEnd}
            UNION ALL
            SELECT "tenantId", date, 0::numeric AS google, spend AS meta FROM "MetaInsight"
            WHERE "tenantId" = ANY(${ids}) AND date >= ${monthStart} AND date <= ${monthEnd}
          ) t
          GROUP BY "tenantId", date
        `,
        prisma.$queryRaw<Array<{ tenantId: string; last: string | null }>>`
          SELECT "tenantId", to_char(MAX(date), 'YYYY-MM-DD') AS last
          FROM (
            SELECT "tenantId", date FROM "GoogleAdsMetric"
            WHERE "tenantId" = ANY(${ids}) AND cost > 0
            UNION ALL
            SELECT "tenantId", date FROM "MetaInsight"
            WHERE "tenantId" = ANY(${ids}) AND spend > 0
          ) t
          GROUP BY "tenantId"
        `,
        prisma.hourlySpend.findMany({
          where: { tenantId: { in: ids }, date: ymdToUtcDate(today) },
          select: { tenantId: true, provider: true, hour: true, spend: true },
        }),
        prisma.accountHealth.findMany({ where: { tenantId: { in: ids } } }),
      ])
    : [[], [], [], [], [], []];
  const hourlyBy = new Map<string, Map<number, HourlyPoint>>();
  const hourlyProviders = new Map<string, Set<string>>();
  for (const h of hourlyRows) {
    let m = hourlyBy.get(h.tenantId);
    if (!m) hourlyBy.set(h.tenantId, (m = new Map()));
    const p = m.get(h.hour) ?? { hour: h.hour, meta: 0, google: 0 };
    p[h.provider] += Number(h.spend);
    m.set(h.hour, p);
    let ps = hourlyProviders.get(h.tenantId);
    if (!ps) hourlyProviders.set(h.tenantId, (ps = new Set()));
    ps.add(h.provider);
  }
  // Saatlik senkron bugün bu sağlayıcı için başarılı çalıştı mı (0 satır = harcama yok).
  const hourlyOkBy = new Map<string, Set<string>>();
  const healthBy = new Map<string, BrandTableRow["accounts"]>();
  for (const h of healthRows) {
    const cur = healthBy.get(h.tenantId) ?? { meta: null, google: null };
    cur[h.provider] = {
      status: (["ok", "warn", "critical"].includes(h.status) ? h.status : "unknown") as AccountState["status"],
      label: h.label,
      detail: h.detail,
      checkedAt: h.checkedAt.toISOString(),
    };
    healthBy.set(h.tenantId, cur);
  }
  const lastSpendBy = new Map(lastSpendRows.map((r) => [r.tenantId, r.last]));

  const budgetBy = new Map(budgets.map((b) => [b.tenantId, b]));
  const campaignBy = new Map(
    campaignBudgets.map((c) => [c.tenantId, Number(c._sum.monthlyBudget ?? 0)]),
  );
  const days = monthDays(month, today);
  const dailyBy = new Map<string, Map<string, SpendRow>>();
  for (const row of spendRows) {
    let m = dailyBy.get(row.tenantId);
    if (!m) dailyBy.set(row.tenantId, (m = new Map()));
    m.set(row.date, row);
  }
  const tenantBySlug = new Map(tenants.map((t) => [t.slug, t]));
  const staleBefore = Date.now() - SYNC_STALE_HOURS * 3_600_000;

  const rows: BrandTableRow[] = [];
  for (const card of cards) {
    const t = tenantBySlug.get(card.slug);
    if (!t) continue;

    // Plan: summarizeBudgetPlan ile aynı öncelik — marka toplamı > kanal payı > kampanya toplamı.
    const b = budgetBy.get(t.id);
    const brandMonthly = b?.monthlyBudget != null ? Number(b.monthlyBudget) : null;
    const channel =
      b && (b.googleBudget != null || b.metaBudget != null)
        ? Number(b.googleBudget ?? 0) + Number(b.metaBudget ?? 0)
        : 0;
    const planned = brandMonthly ?? (channel || campaignBy.get(t.id) || null);

    const byDate = dailyBy.get(t.id);
    const todayStart = Date.parse(`${today}T00:00:00+03:00`);
    // Hesap saat dilimi İstanbul'dan farklı bir güne düşüyorsa saatlik satırlar
    // başka tarihe yazılır — o sağlayıcı için bugün günlük tablodan okunur.
    const hourlyOk = new Set(
      t.syncJobs
        .filter(
          (j) =>
            j.service === "hourly" &&
            j.lastSuccessAt &&
            j.lastSuccessAt.getTime() >= todayStart &&
            hourlyDateFor(t, j.provider) === today,
        )
        .map((j) => j.provider),
    );
    hourlyOkBy.set(t.id, hourlyOk);
    const hourMap = hourlyBy.get(t.id);
    const hourly: HourlyPoint[] = hourMap
      ? Array.from({ length: 24 }, (_, h) => hourMap.get(h) ?? { hour: h, meta: 0, google: 0 })
      : [];
    const hourlyMeta = hourly.reduce((s, h) => s + h.meta, 0);
    const hourlyGoogle = hourly.reduce((s, h) => s + h.google, 0);
    // Bugün: saatlik senkron daha taze — o sağlayıcı için çalıştıysa onu kullan.
    const daily: DailySpend[] = days.map((date) => {
      const meta = byDate?.get(date)?.meta ?? 0;
      const google = byDate?.get(date)?.google ?? 0;
      if (date !== today) return { date, meta, google };
      return {
        date,
        meta: hourlyOk.has("meta") ? Math.max(hourlyMeta, 0) : meta,
        google: hourlyOk.has("google") ? Math.max(hourlyGoogle, 0) : google,
      };
    });
    const spentMeta = daily.reduce((sum, d) => sum + d.meta, 0);
    const spentGoogle = daily.reduce((sum, d) => sum + d.google, 0);
    const todayRow = daily.find((d) => d.date === today);
    const providerToday = (p: "meta" | "google", active: boolean): ProviderToday => {
      if (!active) return { state: "n/a", spend: 0, error: null };
      const job = t.syncJobs.find((j) => j.service === "hourly" && j.provider === p);
      const spend = p === "meta" ? (todayRow?.meta ?? 0) : (todayRow?.google ?? 0);
      if (hourlyOk.has(p)) return { state: "ok", spend, error: null };
      if (job?.status === "error") return { state: "error", spend, error: job.error };
      return { state: "missing", spend, error: null };
    };
    const todayByProvider = {
      meta: providerToday(
        "meta",
        !t.disabledIntegrations.includes("meta") && Boolean(resolveMetaAccountId(t)),
      ),
      google: providerToday(
        "google",
        !t.disabledIntegrations.includes("google_ads") && Boolean(resolveAdsCustomerId(t)),
      ),
    };
    const pacing = computeBudgetPacing({
      planned,
      spent: spentMeta + spentGoogle,
      from: `${month}-01`,
      to: endOfMonthYmd(month),
      today,
      todaySpend: todayRow ? todayRow.meta + todayRow.google : 0,
    });

    const off = new Set(t.disabledIntegrations);
    const jobs = withoutDisabledJobs(
      t.syncJobs.filter((j) => !META_SERVICES.has(j.service)),
      t.disabledIntegrations,
    );
    let lastSync: Date | null = null;
    for (const j of jobs) {
      if (j.lastSuccessAt && (!lastSync || j.lastSuccessAt > lastSync)) {
        lastSync = j.lastSuccessAt;
      }
    }

    const tokens = { meta: "none", google: "none" } as BrandTableRow["tokens"];
    for (const provider of ["meta", "google"] as const) {
      const pj = jobs.filter((j) => j.provider === provider);
      const classes = pj
        .filter((j) => j.status === "error")
        .map((j) => classifySyncError(j.error));
      tokens[provider] = classes.includes("token")
        ? "token"
        : classes.includes("permission")
          ? "permission"
          : pj.some((j) => j.lastSuccessAt)
            ? "ok"
            : "none";
    }

    const todayHasSpend = daily.some(
      (d) => d.date === today && d.meta + d.google > 0,
    );
    const lastSpendDate = todayHasSpend ? today : (lastSpendBy.get(t.id) ?? null);
    const stoppedDays = lastSpendDate
      ? Math.max(0, daysBetween(lastSpendDate, today) - 1)
      : null;
    const reasons: BrandReason[] = [];
    // Eşleşme / sync alarmları aşağıda güncel job durumundan kısa metinle türetilir.
    const derivedAlerts = t.alerts.filter((a) => DERIVED_ALERT.test(a.type));
    if (card.health !== null) {
      const spendStopped =
        stoppedDays != null && stoppedDays >= SPEND_STOP_DAYS;
      for (const a of t.alerts) {
        if (DERIVED_ALERT.test(a.type)) continue;
        // Harcama durmuşken "harcama var, dönüşüm 0" alarmı eski ve yanıltıcı.
        if (spendStopped && a.type === "conv_dropout") continue;
        reasons.push({
          tone: a.severity === "critical" ? "critical" : "warn",
          text: shorten(a.message || a.type),
        });
      }
      if (tokens.meta === "token" || tokens.google === "token") {
        reasons.push({ tone: "critical", text: "API token geçersiz" });
      }
      for (const j of jobs) {
        if (j.status !== "error") continue;
        const cls = classifySyncError(j.error);
        if (cls === "token") continue;
        const label = serviceLabel(j.provider, j.service);
        reasons.push({
          tone: cls === "rate" ? "muted" : "warn",
          text:
            cls === "permission"
              ? `${label}: erişim yok`
              : cls === "setup"
                ? `${label}: kurulum eksik`
                : cls === "rate"
                  ? `${label}: API limiti`
                  : `${label}: çekim hatası`,
        });
      }
      const missing: string[] = [];
      if (!off.has("meta") && !resolveMetaAccountId(t)) missing.push("Meta");
      if (!off.has("google_ads") && !resolveAdsCustomerId(t)) missing.push("Google Ads");
      if (!off.has("ga4") && !t.mapping?.ga4PropertyId) missing.push("GA4");
      if (missing.length) {
        reasons.push({
          tone: "warn",
          text: `Eşleşme eksik: ${missing.join(", ")}`,
        });
      }
      if (!lastSync) {
        reasons.push({ tone: "warn", text: "Hiç senkron olmadı" });
      } else if (lastSync.getTime() < staleBefore) {
        reasons.push({
          tone: "warn",
          text: `Senkron ${SYNC_STALE_HOURS} saatten eski`,
        });
      }
      const acc = healthBy.get(t.id);
      for (const p of ["meta", "google"] as const) {
        if (off.has(p === "meta" ? "meta" : "google_ads")) continue;
        const a = acc?.[p];
        if (a && (a.status === "critical" || a.status === "warn")) {
          reasons.push({
            tone: a.status,
            text: `${p === "meta" ? "Meta" : "Google Ads"} ödeme/hesap: ${a.label}`,
          });
        }
      }
      const allFetched =
        (todayByProvider.meta.state === "ok" || todayByProvider.meta.state === "n/a") &&
        (todayByProvider.google.state === "ok" || todayByProvider.google.state === "n/a") &&
        (todayByProvider.meta.state === "ok" || todayByProvider.google.state === "ok");
      const todayTotal = allFetched
        ? todayByProvider.meta.spend + todayByProvider.google.spend
        : null;
      if (
        todayTotal === 0 &&
        currentHour >= TODAY_NO_SPEND_HOUR &&
        !(stoppedDays != null && stoppedDays >= SPEND_STOP_DAYS)
      ) {
        reasons.push({ tone: "critical", text: "Bugün henüz harcama yok" });
      }
      if (stoppedDays != null && stoppedDays >= SPEND_STOP_DAYS) {
        reasons.push({
          tone: "critical",
          text: `Harcama durdu · son harcama ${dmy(lastSpendDate!)} (${stoppedDays} gün)`,
        });
      }
      const pace = PACE_STATUS_META[pacing.status];
      if (pace.tone === "warn" || pace.tone === "critical") {
        reasons.push({ tone: pace.tone, text: pace.label });
      }
    }
    // Job düzelmiş ama alarm hâlâ açıksa rozetin sebebi boş kalmasın.
    if (card.health !== null && reasons.length === 0) {
      for (const a of derivedAlerts) {
        reasons.push({ tone: "warn", text: shorten(a.message || a.type) });
      }
    }
    // Aynı metin birden çok servisten gelebilir.
    const seen = new Set<string>();
    const uniqueReasons = reasons
      .filter((r) => (seen.has(r.text) ? false : (seen.add(r.text), true)))
      .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);

    rows.push({
      slug: t.slug,
      name: t.name,
      coverUrl: card.coverUrl,
      health: card.health,
      reasons: uniqueReasons,
      currency: t.currency,
      planned,
      spent: spentMeta + spentGoogle,
      paceStatus: pacing.status,
      projectedPct: pacing.projectedPct,
      expectedToDate: pacing.expectedToDate,
      avgDaily: pacing.avgDaily,
      recommendedDaily: pacing.recommendedDaily,
      projected: pacing.projected,
      channels: {
        meta: {
          spent: spentMeta,
          planned: b?.metaBudget != null ? Number(b.metaBudget) : null,
        },
        google: {
          spent: spentGoogle,
          planned: b?.googleBudget != null ? Number(b.googleBudget) : null,
        },
      },
      daily,
      hourly,
      todaySpend: todayRow ? todayRow.meta + todayRow.google : 0,
      hourlyFetched: todayByProvider.meta.state !== "missing" &&
        todayByProvider.meta.state !== "error" &&
        todayByProvider.google.state !== "missing" &&
        todayByProvider.google.state !== "error" &&
        (todayByProvider.meta.state === "ok" || todayByProvider.google.state === "ok"),
      todayByProvider,
      accounts: healthBy.get(t.id) ?? { meta: null, google: null },
      lastSpendDate,
      spendStoppedDays: stoppedDays,
      lastSyncAt: lastSync?.toISOString() ?? null,
      syncStale: !lastSync || lastSync.getTime() < staleBefore,
      tokens,
      owner: t.owner
        ? { id: t.owner.id, label: t.owner.name || t.owner.email }
        : null,
    });
  }

  return { month, today, daysInMonth, currentHour, rows };
}
