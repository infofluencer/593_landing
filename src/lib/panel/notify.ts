/**
 * Kritik uyarı bildirimi — WhatsApp Cloud API (onaylı şablon) öncelikli,
 * e-posta yedek. Alıcı: markanın sorumlusu + uyarı tipine göre ilgili ekip.
 * Aynı uyarı aynı seviyede ikinci kez gönderilmez (Alert.notifiedAt).
 *
 * Env:
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_ALERT_TEMPLATE (vars. "panel_alert"), WHATSAPP_TEMPLATE_LANG (vars. "tr")
 *   Şablon gövdesi 3 parametre alır: {{1}} marka, {{2}} başlık, {{3}} açıklama.
 *   SMTP_HOST/PORT/USER/PASS (e-posta yedek).
 */
import nodemailer from "nodemailer";
import type { AlertSeverity } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rootDomain } from "@/lib/panel/host";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Uyarı tipi → sorumlu ekip (teams.ts slug). Her hata ilgili ekibin
 * üyelerine + markanın sorumlusuna gider; null = yalnızca marka sorumlusu.
 * Meta ekibi: Meta reklam/ödeme/çekim. Google ekibi: Ads ödeme/çekim/eşleşme.
 * Analytics: GA4, GTM, dönüşüm takibi, kurulum (UTM, Pixel/CAPI, dönüşüm).
 */
export const NOTIFY_ALERT_TEAM: Record<string, string | null> = {
  payment_meta: "meta",
  payment_google: "google",
  spend_stopped_meta: "meta",
  spend_stopped_google: "google",
  sync_error_meta: "meta",
  sync_error: "google",
  missing_mapping: "google",
  missing_mapping_meta: "meta",
  missing_mapping_ga4: "analytics",
  missing_mapping_gtm: "analytics",
  missing_mapping_gsc: "analytics",
  token_expired_meta: "meta",
  token_expired_google: "google",
  sync_error_ga4: "analytics",
  conv_dropout: "analytics",
  setup_missing: "analytics",
  site_tag_verify: "analytics",
  budget_over: null,
  cpl_over: null,
};

export const ALERT_TITLE: Record<string, string> = {
  payment_meta: "Meta ödeme / hesap sorunu",
  payment_google: "Google Ads ödeme / hesap sorunu",
  spend_stopped_meta: "Meta harcama durdu",
  spend_stopped_google: "Google Ads harcama durdu",
  budget_over: "Bütçe aşıldı",
  cpl_over: "Lead / satış maliyeti hedefi aşıldı",
  conv_dropout: "Dönüşüm takibi sıfırlandı",
  token_expired_meta: "Meta API erişimi süresi doldu",
  token_expired_google: "Google API erişimi süresi doldu",
  sync_error: "Google Ads çekim hatası",
  sync_error_meta: "Meta çekim hatası",
  sync_error_ga4: "GA4 çekim hatası",
  missing_mapping: "Google Ads eşleşmesi eksik",
  missing_mapping_meta: "Meta reklam hesabı eşleşmesi eksik",
  missing_mapping_ga4: "GA4 property eşleşmesi eksik",
  missing_mapping_gtm: "GTM konteyner eşleşmesi eksik",
  missing_mapping_gsc: "Search Console eşleşmesi eksik",
  setup_missing: "Kurulum eksik",
  site_tag_verify: "Site etiket testi başarısız",
};

/** Ekip adı — mesaj başlığında "[Meta ekibi]" gibi görünür. */
export const TEAM_TITLE: Record<string, string> = {
  meta: "Meta ekibi",
  google: "Google ekibi",
  analytics: "Analytics ekibi",
  "sosyal-medya": "Sosyal Medya ekibi",
  "grafik-tasarim": "Grafik Tasarım ekibi",
  yazilim: "Yazılım ekibi",
};

/** Haritadaki her tip bildirilir; "ok" seviyesi asla. */
export function shouldNotifyAlert(type: string, severity: AlertSeverity): boolean {
  if (!(type in NOTIFY_ALERT_TEAM)) return false;
  return severity !== "ok";
}

export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

/** Şablon parametresi: satır sonu / 4+ boşluk Meta tarafından reddedilir. */
function templateParam(text: string, max = 300): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t || "—";
}

/** E.164: +90… ; başındaki 0 / boşluk / tire temizlenir. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (/^0\d{10}$/.test(p)) p = `+90${p.slice(1)}`;
  if (/^5\d{9}$/.test(p)) p = `+90${p}`;
  if (!/^\+\d{10,15}$/.test(p)) return null;
  return p;
}

export async function sendWhatsAppTemplate(opts: {
  to: string;
  template?: string;
  lang?: string;
  bodyParams: string[];
  /** URL butonunun dinamik son eki (ör. marka slug'ı). */
  buttonParam?: string | null;
}): Promise<{ messageId: string | null }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) {
    throw new Error("WhatsApp Cloud API env eksik (ACCESS_TOKEN / PHONE_NUMBER_ID).");
  }
  const template = opts.template ?? genericTemplateName();
  const lang = opts.lang ?? process.env.WHATSAPP_TEMPLATE_LANG?.trim() ?? "tr";
  const components: unknown[] = [
    {
      type: "body",
      parameters: opts.bodyParams.map((p) => ({ type: "text", text: templateParam(p) })),
    },
  ];
  if (opts.buttonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: templateParam(opts.buttonParam, 80) }],
    });
  }
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: opts.to.replace(/^\+/, ""),
      type: "template",
      template: { name: template, language: { code: lang }, components },
    }),
  });
  const json = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || json.error) {
    throw new WhatsAppError(
      `WhatsApp: ${json.error?.message ?? `HTTP ${res.status}`}${json.error?.code != null ? ` (#${json.error.code})` : ""}`,
      json.error?.code ?? null,
    );
  }
  return { messageId: json.messages?.[0]?.id ?? null };
}

export class WhatsAppError extends Error {
  constructor(message: string, readonly code: number | null) {
    super(message);
    this.name = "WhatsAppError";
  }
}

/* ───────────── Şablonlar ─────────────
 * Her uyarı türünün kendi şablonu var (bkz. docs/whatsapp-templates.md).
 * Şablon adı = WHATSAPP_TEMPLATE_PREFIX (vars. "panel_") + kısa ad.
 * Şablon Meta'da yoksa / parametre sayısı uymuyorsa genel şablona düşülür.
 */
export type WaTemplateKey = "odeme" | "harcama" | "butce" | "maliyet" | "veri" | "olcum" | "alert";

function templatePrefix(): string {
  return process.env.WHATSAPP_TEMPLATE_PREFIX?.trim() ?? "panel_";
}
export function templateName(key: WaTemplateKey): string {
  return `${templatePrefix()}${key}`;
}
function genericTemplateName(): string {
  return process.env.WHATSAPP_ALERT_TEMPLATE?.trim() ?? templateName("alert");
}

const TEMPLATE_BY_TYPE: Record<string, WaTemplateKey> = {
  payment_meta: "odeme",
  payment_google: "odeme",
  spend_stopped_meta: "harcama",
  spend_stopped_google: "harcama",
  budget_over: "butce",
  cpl_over: "maliyet",
  sync_error: "veri",
  sync_error_meta: "veri",
  sync_error_ga4: "veri",
  missing_mapping: "veri",
  missing_mapping_meta: "veri",
  missing_mapping_ga4: "veri",
  missing_mapping_gtm: "veri",
  missing_mapping_gsc: "veri",
  token_expired_meta: "veri",
  token_expired_google: "veri",
  conv_dropout: "olcum",
  setup_missing: "olcum",
  site_tag_verify: "olcum",
};

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function monthTr(ym: string | undefined): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "bu ay";
  return `${TR_MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}
function timeTr(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(Number.isNaN(d.getTime()) ? new Date() : d);
}
function str(d: Record<string, unknown>, k: string, fallback = "—"): string {
  const v = d[k];
  return v == null || v === "" ? fallback : String(v);
}

/**
 * Uyarı → şablon adı + gövde parametreleri. Sıra şablondaki {{n}} sırasıdır;
 * docs/whatsapp-templates.md ile birebir.
 */
export function buildAlertTemplate(alert: {
  type: string;
  message: string | null;
  severity: AlertSeverity;
  details: unknown;
  tenant: { name: string; slug: string };
}): { template: string; params: string[]; buttonParam: string } {
  const d = (alert.details && typeof alert.details === "object" ? alert.details : {}) as Record<string, unknown>;
  const key = TEMPLATE_BY_TYPE[alert.type] ?? "alert";
  const brand = alert.tenant.name;
  const teamSlug = NOTIFY_ALERT_TEAM[alert.type] ?? null;
  const team = teamSlug ? TEAM_TITLE[teamSlug] ?? teamSlug : "Marka sorumlusu";
  const button = alert.tenant.slug;
  switch (key) {
    case "odeme":
      return {
        template: templateName("odeme"),
        params: [brand, str(d, "provider"), str(d, "status"), str(d, "detail", "Ödeme yöntemini kontrol edin"), timeTr(str(d, "checkedAt", ""))],
        buttonParam: button,
      };
    case "harcama":
      return {
        template: templateName("harcama"),
        params: [brand, str(d, "provider"), str(d, "days"), str(d, "lastSpend"), str(d, "cause")],
        buttonParam: button,
      };
    case "butce":
      return {
        template: templateName("butce"),
        params: [brand, monthTr(str(d, "month", "")), str(d, "spent"), str(d, "planned"), str(d, "pct")],
        buttonParam: button,
      };
    case "maliyet":
      return {
        template: templateName("maliyet"),
        params: [brand, str(d, "kind", "Lead maliyeti"), str(d, "actual"), str(d, "target"), monthTr(str(d, "month", ""))],
        buttonParam: button,
      };
    case "veri":
      return {
        template: templateName("veri"),
        params: [brand, str(d, "provider"), str(d, "problem", alert.message ?? "—"), str(d, "action", "Veri çekimi sayfasından yeniden deneyin"), team],
        buttonParam: button,
      };
    case "olcum":
      return {
        template: templateName("olcum"),
        params: [brand, str(d, "topic", ALERT_TITLE[alert.type] ?? alert.type), str(d, "detail", alert.message ?? "—"), str(d, "action", "Ölçüm kurulumunu kontrol edin"), team],
        buttonParam: button,
      };
    default:
      return {
        template: genericTemplateName(),
        params: [brand, `${ALERT_TITLE[alert.type] ?? alert.type} · ${team}`, alert.message ?? "—"],
        buttonParam: button,
      };
  }
}

/** Türe özel şablon; Meta'da yoksa (#132001) veya parametre uymazsa (#132012/132018) genel şablon. */
export async function sendAlertWhatsApp(opts: {
  to: string;
  alert: Parameters<typeof buildAlertTemplate>[0];
}): Promise<{ messageId: string | null; template: string }> {
  const spec = buildAlertTemplate(opts.alert);
  try {
    const r = await sendWhatsAppTemplate({ to: opts.to, template: spec.template, bodyParams: spec.params, buttonParam: spec.buttonParam });
    return { ...r, template: spec.template };
  } catch (err) {
    const code = err instanceof WhatsAppError ? err.code : null;
    const generic = genericTemplateName();
    if (spec.template === generic || ![132001, 132012, 132018, 132015].includes(code ?? -1)) throw err;
    const team = NOTIFY_ALERT_TEAM[opts.alert.type] ? TEAM_TITLE[NOTIFY_ALERT_TEAM[opts.alert.type]!] : "Marka sorumlusu";
    const r = await sendWhatsAppTemplate({
      to: opts.to,
      template: generic,
      bodyParams: [opts.alert.tenant.name, `${ALERT_TITLE[opts.alert.type] ?? opts.alert.type} · ${team}`, opts.alert.message ?? "—"],
      buttonParam: opts.alert.tenant.slug,
    });
    return { ...r, template: generic };
  }
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; content: Buffer | Uint8Array; contentType?: string }>;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 465);
  if (!host || !user || !pass) {
    throw new Error("SMTP env eksik (HOST/USER/PASS).");
  }
  const secure = process.env.SMTP_SECURE !== "false" && port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"593 Panel" <${user}>`,
    to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content),
      contentType: a.contentType,
    })),
  });
}

type Recipient = {
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
};

/** Marka sorumlusu + ilgili ekip üyeleri (tekrarsız). */
async function alertRecipients(opts: {
  ownerId: string | null;
  teamSlug: string | null;
}): Promise<Recipient[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["admin", "team"] },
      OR: [
        ...(opts.ownerId ? [{ id: opts.ownerId }] : []),
        ...(opts.teamSlug
          ? [{ teamMemberships: { some: { team: { slug: opts.teamSlug } } } }]
          : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
  });
  return users.map((u) => ({
    userId: u.id,
    name: u.name || u.email,
    phone: normalizePhone(u.phone),
    email: u.email || null,
  }));
}

function brandLink(slug: string): string {
  return `https://admin.${rootDomain()}/brands/${slug}`;
}

/**
 * Uyarıyı sorumlu + ekibe iletir. Hiçbir zaman fırlatmaz; sonuç
 * NotificationLog'a yazılır. Aynı seviyede tekrar gönderilmez.
 */
export async function notifyAlert(alertId: string): Promise<void> {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        tenant: { select: { id: true, name: true, slug: true, ownerId: true, currency: true } },
      },
    });
    if (!alert || alert.resolved) return;
    if (!shouldNotifyAlert(alert.type, alert.severity)) return;
    if (alert.notifiedAt && alert.notifiedSeverity === alert.severity) return;

    const recipients = await alertRecipients({
      ownerId: alert.tenant.ownerId,
      teamSlug: NOTIFY_ALERT_TEAM[alert.type] ?? null,
    });
    const teamSlug = NOTIFY_ALERT_TEAM[alert.type] ?? null;
    const teamTitle = teamSlug ? TEAM_TITLE[teamSlug] ?? teamSlug : "Marka sorumlusu";
    const title = `${ALERT_TITLE[alert.type] ?? alert.type} · ${teamTitle}`;
    const body = alert.message || title;
    const link = brandLink(alert.tenant.slug);
    const severityLabel =
      alert.severity === "critical" ? "KRİTİK" : alert.severity === "warn" ? "Uyarı" : "Hata";

    // Aynı uyarı için "atlandı" kaydı günde bir kez — her senkronda yığılmasın.
    const recentSkip = await prisma.notificationLog.findFirst({
      where: {
        alertId: alert.id,
        status: "skipped",
        createdAt: { gt: new Date(Date.now() - 24 * 3_600_000) },
      },
      select: { id: true },
    });
    const logSkip = async (channel: string, recipient: string, error: string) => {
      if (recentSkip) return;
      await prisma.notificationLog.create({
        data: { tenantId: alert.tenant.id, alertId: alert.id, channel, recipient, status: "skipped", error },
      });
    };

    if (recipients.length === 0) {
      await logSkip(
        "none",
        "-",
        `Alıcı yok — ${teamTitle}nde üye yok ve markaya sorumlu atanmamış.`,
      );
      return;
    }
    let delivered = 0;

    for (const r of recipients) {
      let sentVia: "whatsapp" | "email" | null = null;
      let waError: string | null = null;
      if (whatsappConfigured() && r.phone) {
        try {
          const sent = await sendAlertWhatsApp({ to: r.phone, alert });
          sentVia = "whatsapp";
          delivered += 1;
          await prisma.notificationLog.create({
            data: {
              tenantId: alert.tenant.id,
              alertId: alert.id,
              channel: "whatsapp",
              recipient: r.phone,
              template: sent.template,
              status: "sent",
            },
          });
        } catch (err) {
          waError = err instanceof Error ? err.message : String(err);
          await prisma.notificationLog.create({
            data: {
              tenantId: alert.tenant.id,
              alertId: alert.id,
              channel: "whatsapp",
              recipient: r.phone,
              status: "failed",
              error: waError,
            },
          });
        }
      }
      if (!sentVia && r.email) {
        if (!smtpConfigured()) {
          await logSkip(
            "email",
            r.email,
            waError
              ? `WhatsApp başarısız (${waError}); SMTP de tanımlı değil.`
              : whatsappConfigured()
                ? "Kullanıcının telefonu yok; SMTP tanımlı değil."
                : "WhatsApp ve SMTP tanımlı değil.",
          );
          continue;
        }
        try {
          await sendEmail({
            to: r.email,
            subject: `[${severityLabel}] ${alert.tenant.name} — ${title}`,
            text: `${alert.tenant.name}\n${title}\n\n${body}\n\nMarka: ${link}`,
          });
          delivered += 1;
          await prisma.notificationLog.create({
            data: {
              tenantId: alert.tenant.id,
              alertId: alert.id,
              channel: "email",
              recipient: r.email,
              status: "sent",
              error: waError ? `WhatsApp başarısız, e-posta gönderildi: ${waError}` : null,
            },
          });
        } catch (err) {
          await prisma.notificationLog.create({
            data: {
              tenantId: alert.tenant.id,
              alertId: alert.id,
              channel: "email",
              recipient: r.email,
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    }

    // Hiçbir kanaldan gitmediyse "bildirildi" sayma — kanal tanımlanınca tekrar denenir.
    if (delivered > 0) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { notifiedAt: new Date(), notifiedSeverity: alert.severity },
      });
    }
  } catch (err) {
    console.error("[notify] alert", alertId, err);
  }
}

/** Ekip sayfasından "test mesajı": env + şablon onayını doğrular. */
export async function sendTestWhatsApp(opts: {
  to: string;
  byEmail: string | null;
}): Promise<{ messageId: string | null }> {
  const phone = normalizePhone(opts.to);
  if (!phone) throw new Error("Telefon +90 5xx xxx xx xx biçiminde olmalı.");
  const r = await sendWhatsAppTemplate({
    to: phone,
    bodyParams: ["593 Panel", "Test bildirimi · Ajans", `WhatsApp bildirim kanalı çalışıyor (${opts.byEmail ?? "panel"}).`],
    buttonParam: "",
  });
  await prisma.notificationLog.create({
    data: {
      channel: "whatsapp",
      recipient: phone,
      template: genericTemplateName(),
      status: "sent",
      error: "test",
    },
  });
  return r;
}

export type SerializedNotification = {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  error: string | null;
  alertType: string | null;
  alertMessage: string | null;
  createdAt: string;
};

export async function listNotifications(
  tenantId: string,
  take = 10,
): Promise<SerializedNotification[]> {
  const rows = await prisma.notificationLog.findMany({
    where: { tenantId },
    include: { alert: { select: { type: true, message: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    recipient: r.recipient,
    status: r.status,
    error: r.error,
    alertType: r.alert?.type ?? null,
    alertMessage: r.alert?.message ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
