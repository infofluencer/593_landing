/**
 * Görev ataması bildirimi — durum panosunda bir karta yeni atanan kişiye
 * WhatsApp (onaylı şablon) gider. Uyarılarla aynı ana anahtar geçerli
 * (/bildirimler → WhatsApp kanalı). Kendine atama bildirilmez.
 *
 * Şablon: `${WHATSAPP_TEMPLATE_PREFIX}gorev` (vars. `uyari_gorev`), UTILITY, tr.
 * Gövde parametreleri sırasıyla: görev, açıklama, marka, son tarih, öncelik, atayan.
 * URL butonu: https://admin.593emarketing.com/board?card={{1}} (kart id).
 * Bkz. docs/whatsapp-templates.md.
 */
import { prisma } from "@/lib/db";
import { whatsappEnabled } from "@/lib/panel/notification-settings";
import {
  normalizePhone,
  sendWhatsAppTemplate,
  templateName,
  whatsappConfigured,
} from "@/lib/panel/notify";

const PRIORITY_TR: Record<string, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

export function taskTemplateName(): string {
  return templateName("gorev");
}

/** Açıklama tek satıra iner (şablon parametresi satır sonu kabul etmez). */
function plainDescription(text: string | null): string {
  const t = (text ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "Açıklama eklenmedi";
  return t.length > 280 ? `${t.slice(0, 279)}…` : t;
}

function dueTr(d: Date | null): string {
  if (!d) return "Belirtilmedi";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Yeni atananlara bildirim. Hiçbir zaman fırlatmaz; sonuç NotificationLog'a
 * yazılır. Yanıtı geciktirmemesi için `after()` içinde çağırın.
 */
export async function notifyTaskAssigned(opts: {
  cardId: string;
  userIds: string[];
  actorId: string | null;
}): Promise<void> {
  try {
    const ids = [...new Set(opts.userIds)].filter((id) => id && id !== opts.actorId);
    if (ids.length === 0) return;
    if (!whatsappConfigured() || !(await whatsappEnabled())) return;

    const [card, users, actor] = await Promise.all([
      prisma.boardCard.findUnique({
        where: { id: opts.cardId },
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          priority: true,
          tenantId: true,
          tenant: { select: { name: true } },
          team: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        where: { id: { in: ids }, role: { in: ["admin", "team"] } },
        select: { id: true, name: true, email: true, phone: true },
      }),
      opts.actorId
        ? prisma.user.findUnique({
            where: { id: opts.actorId },
            select: { name: true, email: true },
          })
        : null,
    ]);
    if (!card) return;

    const template = taskTemplateName();
    const brand = card.tenant?.name ?? card.team?.name ?? "Genel";
    const actorName = actor ? actor.name || actor.email : "593 Panel";
    const params = [
      card.title,
      plainDescription(card.description),
      brand,
      dueTr(card.dueAt),
      PRIORITY_TR[card.priority] ?? card.priority,
      actorName,
    ];
    const note = `Görev ataması: ${card.title}`.slice(0, 300);

    for (const u of users) {
      const phone = normalizePhone(u.phone);
      if (!phone) {
        await prisma.notificationLog.create({
          data: {
            tenantId: card.tenantId,
            channel: "none",
            recipient: u.name || u.email,
            template,
            status: "skipped",
            error: `${note} — kullanıcının telefonu yok`,
          },
        });
        continue;
      }
      try {
        await sendWhatsAppTemplate({
          to: phone,
          template,
          bodyParams: params,
          buttonParam: card.id,
        });
        await prisma.notificationLog.create({
          data: {
            tenantId: card.tenantId,
            channel: "whatsapp",
            recipient: phone,
            template,
            status: "sent",
            error: note,
          },
        });
      } catch (err) {
        await prisma.notificationLog.create({
          data: {
            tenantId: card.tenantId,
            channel: "whatsapp",
            recipient: phone,
            template,
            status: "failed",
            error: `${note} — ${err instanceof Error ? err.message : String(err)}`.slice(0, 1000),
          },
        });
      }
    }
  } catch (err) {
    console.error("[notify] task", opts.cardId, err);
  }
}
