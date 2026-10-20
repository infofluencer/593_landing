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

/** Bildirim gönderilen uyarı tipleri → ilgili ekip (teams.ts slug). */
export const NOTIFY_ALERT_TEAM: Record<string, string | null> = {
  payment_meta: "meta",
  payment_google: "google",
  spend_stopped_meta: "meta",
  spend_stopped_google: "google",
  budget_over: null,
  cpl_over: null,
  conv_dropout: "analytics",
  token_expired: null,
};

export const ALERT_TITLE: Record<string, string> = {
  payment_meta: "Meta ödeme / hesap sorunu",
  payment_google: "Google Ads ödeme / hesap sorunu",
  spend_stopped_meta: "Meta harcama durdu",
  spend_stopped_google: "Google Ads harcama durdu",
  budget_over: "Bütçe aşıldı",
  cpl_over: "Lead / satış maliyeti hedefi aşıldı",
  conv_dropout: "Dönüşüm takibi sıfırlandı",
  token_expired: "API erişimi süresi doldu",
  sync_error: "Google Ads çekim hatası",
  sync_error_meta: "Meta çekim hatası",
  sync_error_ga4: "GA4 çekim hatası",
  missing_mapping: "Eşleşme eksik",
};

export function shouldNotifyAlert(type: string, severity: AlertSeverity): boolean {
  if (!(type in NOTIFY_ALERT_TEAM)) return false;
  return severity === "critical" || severity === "warn";
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
}): Promise<{ messageId: string | null }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) {
    throw new Error("WhatsApp Cloud API env eksik (ACCESS_TOKEN / PHONE_NUMBER_ID).");
  }
  const template =
    opts.template ?? process.env.WHATSAPP_ALERT_TEMPLATE?.trim() ?? "panel_alert";
  const lang = opts.lang ?? process.env.WHATSAPP_TEMPLATE_LANG?.trim() ?? "tr";
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
      template: {
        name: template,
        language: { code: lang },
        components: [
          {
            type: "body",
            parameters: opts.bodyParams.map((p) => ({
              type: "text",
              text: templateParam(p),
            })),
          },
        ],
      },
    }),
  });
  const json = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || json.error) {
    throw new Error(
      `WhatsApp: ${json.error?.message ?? `HTTP ${res.status}`}${json.error?.code != null ? ` (#${json.error.code})` : ""}`,
    );
  }
  return { messageId: json.messages?.[0]?.id ?? null };
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
        tenant: { select: { id: true, name: true, slug: true, ownerId: true } },
      },
    });
    if (!alert || alert.resolved) return;
    if (!shouldNotifyAlert(alert.type, alert.severity)) return;
    if (alert.notifiedAt && alert.notifiedSeverity === alert.severity) return;

    const recipients = await alertRecipients({
      ownerId: alert.tenant.ownerId,
      teamSlug: NOTIFY_ALERT_TEAM[alert.type] ?? null,
    });
    const title = ALERT_TITLE[alert.type] ?? alert.type;
    const body = alert.message || title;
    const link = brandLink(alert.tenant.slug);
    const severityLabel = alert.severity === "critical" ? "KRİTİK" : "Uyarı";

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
      await logSkip("none", "-", "Alıcı yok — markaya sorumlu atanmamış ve ilgili ekipte üye yok.");
      return;
    }
    let delivered = 0;

    for (const r of recipients) {
      let sentVia: "whatsapp" | "email" | null = null;
      let waError: string | null = null;
      if (whatsappConfigured() && r.phone) {
        try {
          await sendWhatsAppTemplate({
            to: r.phone,
            bodyParams: [alert.tenant.name, `${severityLabel} · ${title}`, body],
          });
          sentVia = "whatsapp";
          delivered += 1;
          await prisma.notificationLog.create({
            data: {
              tenantId: alert.tenant.id,
              alertId: alert.id,
              channel: "whatsapp",
              recipient: r.phone,
              template: process.env.WHATSAPP_ALERT_TEMPLATE?.trim() ?? "panel_alert",
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
