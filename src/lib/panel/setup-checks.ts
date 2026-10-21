/**
 * Otomatik kurulum kontrolü — marka başına: UTM, GA4 anahtar etkinlik,
 * Meta Pixel / CAPI, Google Ads dönüşüm takibi. Sonuç SetupCheck tablosuna
 * yazılır; eksikler marka kartındaki durum sebebine yansır.
 *
 * Her kontrol bağımsızdır: biri hata verirse "unknown" olur, diğerleri yazılır.
 * `manual=true` satırlar (ajans elle onayladı) üzerine yazılmaz.
 */
import { prisma } from "@/lib/db";
import { addDaysYmd, istanbulYmd, ymdToUtcDate } from "@/lib/date/tr";
import { adsSearch } from "@/lib/integrations/google/ads";
import { getMetaSystemUserToken } from "@/lib/integrations/tokens";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { resolveMetaAccountId } from "@/lib/panel/meta-ad-account-map";
import { resolveOpenAlertsOfType, upsertOpenAlert } from "@/lib/panel/alerts-engine";

const GRAPH = "https://graph.facebook.com/v21.0";

export type SetupCheckKey =
  | "utm"
  | "ga4_key_event"
  | "meta_pixel"
  | "meta_capi"
  | "google_ads_conversion";

export type SetupCheckStatus = "ok" | "missing" | "unknown";

export const SETUP_CHECK_KEYS: SetupCheckKey[] = [
  "utm",
  "ga4_key_event",
  "meta_pixel",
  "meta_capi",
  "google_ads_conversion",
];

export const SETUP_CHECK_LABEL: Record<SetupCheckKey, string> = {
  utm: "UTM parametreleri",
  ga4_key_event: "GA4 anahtar etkinlik",
  meta_pixel: "Meta Pixel",
  meta_capi: "Meta CAPI",
  google_ads_conversion: "Google Ads dönüşüm takibi",
};

/** Marka kartı sebebi için kısa ad. */
export const SETUP_CHECK_SHORT: Record<SetupCheckKey, string> = {
  utm: "UTM",
  ga4_key_event: "GA4 key event",
  meta_pixel: "Pixel",
  meta_capi: "CAPI",
  google_ads_conversion: "Ads dönüşüm",
};

export type SetupCheckResult = {
  key: SetupCheckKey;
  status: SetupCheckStatus;
  detail: string | null;
};

/** Kontrol hangi platforma bağlı — platform markada kapalıysa atlanır. */
const CHECK_INTEGRATION: Record<SetupCheckKey, string[]> = {
  utm: ["meta", "google_ads"],
  ga4_key_event: ["ga4"],
  meta_pixel: ["meta"],
  meta_capi: ["meta"],
  google_ads_conversion: ["google_ads"],
};

function hasUtm(s: string | null | undefined): boolean {
  return Boolean(s && /utm_(source|medium|campaign)/i.test(s));
}

/** Meta içi / mesajlaşma hedefleri — UTM taşıyamaz (form, Messenger, WhatsApp, profil). */
const NON_WEB_HOST =
  /(^|\.)(fb\.me|facebook\.com|fb\.com|instagram\.com|whatsapp\.com|wa\.me|m\.me|messenger\.com)$/i;

/** Reklam bir web sitesine mi gidiyor? UTM yalnızca bunlarda beklenir. */
function isWebDestination(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) && !NON_WEB_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

function actId(id: string): string {
  return id.startsWith("act_") ? id : `act_${id}`;
}

type TenantForChecks = {
  id: string;
  slug: string;
  name: string;
  metaAccountId: string;
  disabledIntegrations: string[];
  mapping: { adsCustomerId: string | null; ga4PropertyId: string | null } | null;
};

async function checkUtm(t: TenantForChecks): Promise<SetupCheckResult> {
  const off = new Set(t.disabledIntegrations);
  const parts: string[] = [];
  let anyMissing = false;
  let anyKnown = false;

  if (!off.has("meta")) {
    const ads = await prisma.metaAd.findMany({
      where: { tenantId: t.id, effectiveStatus: "ACTIVE" },
      select: { urlTags: true, linkUrl: true },
    });
    // url_tags doluysa hedef ne olursa olsun say; yoksa yalnızca siteye giden reklamlar.
    const webAds = ads.filter((a) => a.urlTags || isWebDestination(a.linkUrl));
    if (webAds.length > 0) {
      anyKnown = true;
      const withoutUtm = webAds.filter(
        (a) => !hasUtm(a.urlTags) && !hasUtm(a.linkUrl),
      ).length;
      if (withoutUtm > 0) {
        anyMissing = true;
        parts.push(`Meta: siteye giden ${withoutUtm}/${webAds.length} aktif reklamda UTM yok`);
      } else {
        parts.push(`Meta: siteye giden ${webAds.length} aktif reklamın hepsinde UTM var`);
      }
    } else if (ads.length > 0) {
      parts.push("Meta: siteye giden aktif reklam yok (form / mesaj / etkileşim)");
    }
  }

  const customerId = off.has("google_ads") ? null : resolveAdsCustomerId(t);
  if (customerId) {
    // Google hatası Meta sonucunu silmesin.
    const json = await adsSearch({
      customerId,
      query:
        "SELECT customer.auto_tagging_enabled, customer.tracking_url_template, customer.final_url_suffix FROM customer LIMIT 1",
    })
      .then((r) => r.json)
      .catch((e: unknown) => {
        parts.push(`Google Ads: kontrol edilemedi (${(e instanceof Error ? e.message : String(e)).slice(0, 80)})`);
        return null;
      });
    const c = (json?.results?.[0] as {
      customer?: {
        autoTaggingEnabled?: boolean;
        trackingUrlTemplate?: string;
        finalUrlSuffix?: string;
      };
    } | undefined)?.customer;
    if (c) {
      anyKnown = true;
      const ok =
        c.autoTaggingEnabled === true ||
        hasUtm(c.trackingUrlTemplate) ||
        hasUtm(c.finalUrlSuffix);
      if (ok) {
        parts.push(
          c.autoTaggingEnabled
            ? "Google Ads: otomatik etiketleme açık"
            : "Google Ads: UTM şablonu tanımlı",
        );
      } else {
        anyMissing = true;
        parts.push("Google Ads: otomatik etiketleme kapalı, UTM şablonu yok");
      }
    }
  }

  return {
    key: "utm",
    status: !anyKnown ? "unknown" : anyMissing ? "missing" : "ok",
    detail: parts.join(" · ") || "Kontrol edilecek aktif reklam / hesap yok",
  };
}

async function checkGa4KeyEvent(t: TenantForChecks): Promise<SetupCheckResult> {
  if (!t.mapping?.ga4PropertyId) {
    return { key: "ga4_key_event", status: "unknown", detail: "GA4 mülkü bağlı değil" };
  }
  const since = ymdToUtcDate(addDaysYmd(istanbulYmd(), -30));
  const rows = await prisma.ga4Metric.findMany({
    where: { tenantId: t.id, dimensionType: "channel", date: { gte: since } },
    select: { keyEvents: true, sessions: true, sessionConversionRate: true },
  });
  if (rows.length === 0) {
    return {
      key: "ga4_key_event",
      status: "unknown",
      detail: "Son 30 günde GA4 verisi yok — senkron bekleniyor",
    };
  }
  const total = rows.reduce(
    (s, r) =>
      s +
      (r.keyEvents != null
        ? Number(r.keyEvents)
        : (r.sessions ?? 0) * Number(r.sessionConversionRate ?? 0)),
    0,
  );
  return total > 0
    ? { key: "ga4_key_event", status: "ok", detail: `Son 30 günde ${Math.round(total)} anahtar etkinlik` }
    : { key: "ga4_key_event", status: "missing", detail: "Son 30 günde hiç anahtar etkinlik gelmedi — tanım eksik olabilir" };
}

type PixelRow = { id?: string; name?: string; last_fired_time?: string };

async function listPixels(metaAccountId: string): Promise<PixelRow[]> {
  const params = new URLSearchParams({
    access_token: getMetaSystemUserToken(),
    fields: "id,name,last_fired_time",
  });
  const res = await fetch(`${GRAPH}/${actId(metaAccountId)}/adspixels?${params}`);
  const json = (await res.json()) as { data?: PixelRow[]; error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta HTTP ${res.status}`);
  }
  return json.data ?? [];
}

async function checkMetaPixel(
  t: TenantForChecks,
  pixels: PixelRow[],
): Promise<SetupCheckResult> {
  if (pixels.length === 0) {
    return { key: "meta_pixel", status: "missing", detail: "Reklam hesabında Pixel tanımlı değil" };
  }
  const now = Date.now();
  let freshest: number | null = null;
  for (const p of pixels) {
    if (!p.last_fired_time) continue;
    const ts = Date.parse(p.last_fired_time);
    if (!Number.isNaN(ts) && (freshest == null || ts > freshest)) freshest = ts;
  }
  if (freshest == null) {
    return { key: "meta_pixel", status: "missing", detail: `${pixels[0]!.name ?? "Pixel"} hiç tetiklenmemiş` };
  }
  const days = Math.floor((now - freshest) / 86_400_000);
  return days <= 3
    ? { key: "meta_pixel", status: "ok", detail: `Son tetiklenme ${days === 0 ? "bugün" : `${days} gün önce`}` }
    : { key: "meta_pixel", status: "missing", detail: `Pixel ${days} gündür tetiklenmiyor` };
}

async function checkMetaCapi(pixels: PixelRow[]): Promise<SetupCheckResult> {
  const withId = pixels.filter((p) => p.id);
  if (withId.length === 0) {
    return { key: "meta_capi", status: "missing", detail: "Pixel yok — CAPI kurulamaz" };
  }
  // Hesaptaki ilk Pixel çoğu zaman boş / çevrimdışı veri seti — tetiklenenlerin hepsine bak.
  const fired = withId.filter((p) => p.last_fired_time);
  const targets = (fired.length > 0 ? fired : withId).slice(0, 5);
  const start = Math.floor((Date.now() - 7 * 86_400_000) / 1000);
  let server = 0;
  let web = 0;
  for (const pixel of targets) {
    const params = new URLSearchParams({
      access_token: getMetaSystemUserToken(),
      aggregation: "event_source",
      start_time: String(start),
    });
    const res = await fetch(`${GRAPH}/${pixel.id}/stats?${params}`);
    const json = (await res.json()) as {
      data?: Array<{ data?: Array<{ value?: string; count?: number | string }> }>;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `Meta HTTP ${res.status}`);
    }
    for (const bucket of json.data ?? []) {
      for (const row of bucket.data ?? []) {
        const n = Number(row.count ?? 0);
        if (/server|capi|conversions_api/i.test(row.value ?? "")) server += n;
        else if (/web|browser|pixel/i.test(row.value ?? "")) web += n;
      }
    }
  }
  if (server > 0) {
    return { key: "meta_capi", status: "ok", detail: `Son 7 günde ${server} sunucu olayı (web ${web})` };
  }
  return {
    key: "meta_capi",
    status: "missing",
    detail: web > 0 ? "Olaylar yalnızca tarayıcıdan geliyor — CAPI kurulu değil" : "Son 7 günde CAPI olayı yok",
  };
}

async function checkGoogleConversion(
  t: TenantForChecks,
  customerId: string,
): Promise<SetupCheckResult> {
  const { json } = await adsSearch({
    customerId,
    query:
      "SELECT conversion_action.id, conversion_action.name, conversion_action.primary_for_goal FROM conversion_action WHERE conversion_action.status = 'ENABLED'",
  });
  const actions = (json.results ?? []) as Array<{
    conversionAction?: { name?: string; primaryForGoal?: boolean };
  }>;
  const primary = actions.filter((a) => a.conversionAction?.primaryForGoal !== false);
  if (primary.length === 0) {
    return {
      key: "google_ads_conversion",
      status: "missing",
      detail: "Hesapta etkin birincil dönüşüm işlemi yok",
    };
  }
  const since = ymdToUtcDate(addDaysYmd(istanbulYmd(), -30));
  const conv = await prisma.conversion.aggregate({
    where: { tenantId: t.id, source: "Google Ads", primary: true, date: { gte: since } },
    _sum: { count: true },
  });
  const total = Number(conv._sum.count ?? 0);
  return total > 0
    ? {
        key: "google_ads_conversion",
        status: "ok",
        detail: `${primary.length} dönüşüm işlemi · son 30 günde ${Math.round(total)} dönüşüm`,
      }
    : {
        key: "google_ads_conversion",
        status: "missing",
        detail: `${primary.length} dönüşüm işlemi tanımlı ama 30 gündür dönüşüm gelmiyor`,
      };
}

async function save(tenantId: string, r: SetupCheckResult) {
  const existing = await prisma.setupCheck.findUnique({
    where: { tenantId_key: { tenantId, key: r.key } },
    select: { manual: true },
  });
  if (existing?.manual) return;
  await prisma.setupCheck.upsert({
    where: { tenantId_key: { tenantId, key: r.key } },
    update: { status: r.status, detail: r.detail, checkedAt: new Date() },
    create: { tenantId, key: r.key, status: r.status, detail: r.detail },
  });
}

function unknown(key: SetupCheckKey, err: unknown): SetupCheckResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { key, status: "unknown", detail: `Kontrol edilemedi: ${msg.slice(0, 160)}` };
}

/** Bir markanın tüm kontrollerini çalıştırır ve kaydeder. Asla fırlatmaz. */
export async function runSetupChecks(tenantId: string): Promise<void> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      metaAccountId: true,
      disabledIntegrations: true,
      mapping: { select: { adsCustomerId: true, ga4PropertyId: true } },
    },
  });
  if (!t) return;
  const off = new Set(t.disabledIntegrations);
  const skip = (key: SetupCheckKey) =>
    CHECK_INTEGRATION[key].every((i) => off.has(i));

  // Platformu kapalı kontroller listeden düşer.
  const skipped = SETUP_CHECK_KEYS.filter(skip);
  if (skipped.length) {
    await prisma.setupCheck.deleteMany({ where: { tenantId, key: { in: skipped } } });
  }

  if (!skip("utm")) {
    await save(tenantId, await checkUtm(t).catch((e) => unknown("utm", e)));
  }
  if (!skip("ga4_key_event")) {
    await save(tenantId, await checkGa4KeyEvent(t).catch((e) => unknown("ga4_key_event", e)));
  }

  const metaAccountId = off.has("meta") ? null : resolveMetaAccountId(t);
  if (metaAccountId) {
    let pixels: PixelRow[] | null = null;
    try {
      pixels = await listPixels(metaAccountId);
    } catch (e) {
      await save(tenantId, unknown("meta_pixel", e));
      await save(tenantId, unknown("meta_capi", e));
    }
    if (pixels) {
      await save(tenantId, await checkMetaPixel(t, pixels).catch((e) => unknown("meta_pixel", e)));
      await save(tenantId, await checkMetaCapi(pixels).catch((e) => unknown("meta_capi", e)));
    }
  } else if (!off.has("meta")) {
    await save(tenantId, { key: "meta_pixel", status: "unknown", detail: "Meta hesabı bağlı değil" });
    await save(tenantId, { key: "meta_capi", status: "unknown", detail: "Meta hesabı bağlı değil" });
  }

  const customerId = off.has("google_ads") ? null : resolveAdsCustomerId(t);
  if (customerId) {
    await save(
      tenantId,
      await checkGoogleConversion(t, customerId).catch((e) => unknown("google_ads_conversion", e)),
    );
  } else if (!off.has("google_ads")) {
    await save(tenantId, {
      key: "google_ads_conversion",
      status: "unknown",
      detail: "Google Ads hesabı bağlı değil",
    });
  }

  // Eksikler Analytics ekibine uyarı olarak düşer; tamamlanınca kapanır.
  const rows = await prisma.setupCheck.findMany({ where: { tenantId, status: "missing" } });
  if (rows.length) {
    await upsertOpenAlert({
      tenantId,
      type: "setup_missing",
      severity: "warn",
      message: `Kurulum eksik: ${rows
        .map((r) => `${SETUP_CHECK_SHORT[r.key as SetupCheckKey] ?? r.key}${r.detail ? ` (${r.detail})` : ""}`)
        .join(" · ")}`,
      details: {
        topic: "Kurulum eksik",
        detail: rows
          .map((r) => `${SETUP_CHECK_LABEL[r.key as SetupCheckKey] ?? r.key}${r.detail ? `: ${r.detail}` : ""}`)
          .join("; "),
        action: "Marka detayındaki kurulum kontrol listesinden eksikleri tamamlayın",
      },
    });
  } else {
    await resolveOpenAlertsOfType(tenantId, "setup_missing", "Kurulum tamamlandı");
  }
}

export type SetupCheckRow = {
  key: SetupCheckKey;
  label: string;
  status: SetupCheckStatus;
  detail: string | null;
  manual: boolean;
  checkedAt: string;
};

/** Marka başına kontrol listesi (sabit sırada; olmayan anahtar "unknown"). */
export async function loadSetupChecks(
  tenantIds: string[],
): Promise<Map<string, SetupCheckRow[]>> {
  const rows = await prisma.setupCheck.findMany({
    where: { tenantId: { in: tenantIds } },
  });
  const out = new Map<string, SetupCheckRow[]>();
  for (const id of tenantIds) {
    const mine = rows.filter((r) => r.tenantId === id);
    out.set(
      id,
      SETUP_CHECK_KEYS.flatMap((key) => {
        const r = mine.find((x) => x.key === key);
        if (!r) return [];
        return [
          {
            key,
            label: SETUP_CHECK_LABEL[key],
            status: (["ok", "missing", "unknown"].includes(r.status)
              ? r.status
              : "unknown") as SetupCheckStatus,
            detail: r.detail,
            manual: r.manual,
            checkedAt: r.checkedAt.toISOString(),
          },
        ];
      }),
    );
  }
  return out;
}

/** Marka kartı sebebi: "Kurulum eksik: UTM, Pixel". */
export function setupMissingText(rows: SetupCheckRow[] | undefined): string | null {
  const missing = (rows ?? []).filter((r) => r.status === "missing");
  if (missing.length === 0) return null;
  return `Kurulum eksik: ${missing.map((r) => SETUP_CHECK_SHORT[r.key]).join(", ")}`;
}
