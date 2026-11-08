/** /bildirimler sayfasının veri katmanı: Meta canlı durumu + bildirim kayıtları. */
import type { AlertSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  NOTIFY_ALERT_TEAM,
  WA_TEMPLATES,
  genericTemplateName,
  shouldNotifyAlert,
  templateName,
} from "@/lib/panel/notify";

const GRAPH = "https://graph.facebook.com/v21.0";

async function graphGet<T>(path: string): Promise<T> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN tanımlı değil.");
  const res = await fetch(`${GRAPH}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json()) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || json.error) {
    const code = json.error?.code != null ? ` (#${json.error.code})` : "";
    throw new Error(`${json.error?.message ?? `HTTP ${res.status}`}${code}`);
  }
  return json;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type PhoneStatus =
  | {
      ok: true;
      name: string | null;
      number: string | null;
      status: string | null;
      quality: string | null;
      limitTier: string | null;
    }
  | { ok: false; error: string };

export async function loadPhoneStatus(): Promise<PhoneStatus | null> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneId || !process.env.WHATSAPP_ACCESS_TOKEN?.trim()) return null;
  try {
    const r = await graphGet<{
      verified_name?: string;
      display_phone_number?: string;
      status?: string;
      quality_rating?: string;
      messaging_limit_tier?: string;
    }>(
      `${encodeURIComponent(phoneId)}?fields=verified_name,display_phone_number,status,quality_rating,messaging_limit_tier`,
    );
    return {
      ok: true,
      name: r.verified_name ?? null,
      number: r.display_phone_number ?? null,
      status: r.status ?? null,
      quality: r.quality_rating ?? null,
      limitTier: r.messaging_limit_tier ?? null,
    };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export type TemplateRow = {
  name: string;
  label: string;
  /** null = hesapta bu adla ve dilde şablon yok. */
  status: string | null;
  category: string | null;
  rejectedReason: string | null;
};

export type TemplateStatus =
  | { state: "not_configured" }
  | { state: "error"; error: string }
  | { state: "ok"; rows: TemplateRow[] };

export async function loadTemplateStatus(): Promise<TemplateStatus> {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (!waba || !process.env.WHATSAPP_ACCESS_TOKEN?.trim()) {
    return { state: "not_configured" };
  }
  const lang = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "tr";
  try {
    const r = await graphGet<{
      data?: Array<{
        name: string;
        status?: string;
        language?: string;
        category?: string;
        rejected_reason?: string;
      }>;
    }>(
      `${encodeURIComponent(waba)}/message_templates?fields=name,status,language,category,rejected_reason&limit=200`,
    );
    const rows = WA_TEMPLATES.map(({ key, label }) => {
      const name = key === "alert" ? genericTemplateName() : templateName(key);
      const t = (r.data ?? []).find((x) => x.name === name && x.language === lang);
      const reason = t?.rejected_reason;
      return {
        name,
        label,
        status: t?.status ?? null,
        category: t?.category ?? null,
        rejectedReason: reason && reason !== "NONE" ? reason : null,
      };
    });
    return { state: "ok", rows };
  } catch (err) {
    return { state: "error", error: errorText(err) };
  }
}

export type PendingAlert = {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string | null;
  tenantName: string;
  tenantSlug: string;
  createdAt: string;
};

/**
 * Bildirim bekleyen açık uyarılar: hiç iletilmemiş veya son iletimden sonra
 * seviyesi değişmiş olanlar. notifyAlert ile aynı kuralı izler.
 */
export async function listPendingAlerts(): Promise<PendingAlert[]> {
  const rows = await prisma.alert.findMany({
    where: { resolved: false, type: { in: Object.keys(NOTIFY_ALERT_TEAM) } },
    include: { tenant: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows
    .filter(
      (a) =>
        shouldNotifyAlert(a.type, a.severity) &&
        !(a.notifiedAt && a.notifiedSeverity === a.severity),
    )
    .map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      message: a.message,
      tenantName: a.tenant.name,
      tenantSlug: a.tenant.slug,
      createdAt: a.createdAt.toISOString(),
    }));
}

export const LOG_CHANNELS = ["whatsapp", "email", "none"] as const;
export const LOG_STATUSES = ["sent", "failed", "skipped"] as const;
export const LOG_PAGE_SIZE = 30;

export type LogRow = {
  id: string;
  channel: string;
  recipient: string;
  template: string | null;
  status: string;
  error: string | null;
  alertType: string | null;
  tenantName: string | null;
  createdAt: string;
};

export async function listNotificationLog(opts: {
  channel: string | null;
  status: string | null;
  page: number;
}): Promise<{ rows: LogRow[]; total: number }> {
  const where: Prisma.NotificationLogWhereInput = {
    ...(opts.channel ? { channel: opts.channel } : {}),
    ...(opts.status ? { status: opts.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      include: {
        tenant: { select: { name: true } },
        alert: { select: { type: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * LOG_PAGE_SIZE,
      take: LOG_PAGE_SIZE,
    }),
    prisma.notificationLog.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      recipient: r.recipient,
      template: r.template,
      status: r.status,
      error: r.error,
      alertType: r.alert?.type ?? null,
      tenantName: r.tenant?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export type TestAttempt = {
  id: string;
  recipient: string;
  status: string;
  error: string | null;
  createdAt: string;
};

/** Test formundan yapılan son denemeler (markaya / uyarıya bağlı olmayan kayıtlar). */
export async function listRecentTests(take = 5): Promise<TestAttempt[]> {
  const rows = await prisma.notificationLog.findMany({
    where: { channel: "whatsapp", tenantId: null, alertId: null },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    recipient: r.recipient,
    status: r.status,
    error: r.error === "test" ? null : r.error,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Son 7 günün durum sayıları ve bildirim alamayacak (telefonsuz) staff sayısı. */
export async function loadNotificationStats() {
  const since = new Date(Date.now() - 7 * 24 * 3_600_000);
  const [byStatus, staffWithoutPhone] = await Promise.all([
    prisma.notificationLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.user.count({
      where: {
        role: { in: ["admin", "team"] },
        OR: [{ phone: null }, { phone: "" }],
      },
    }),
  ]);
  const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  return {
    sent: count("sent"),
    failed: count("failed"),
    skipped: count("skipped"),
    staffWithoutPhone,
  };
}
