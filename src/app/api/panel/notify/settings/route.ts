import { NextResponse } from "next/server";
import { audit } from "@/lib/panel/audit";
import {
  emailAlertsEnabled,
  nextMorningStart,
  setEmailAlertsEnabled,
  setWhatsappEnabled,
  whatsappSwitch,
} from "@/lib/panel/notification-settings";
import { requirePermissionApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

/**
 * PATCH {whatsappEnabled?, whatsappStart?: "now" | "tomorrow", emailAlertsEnabled?}
 * — "tomorrow": anahtar açılır ama gönderim ertesi sabah kontrolünde başlar.
 */
export async function PATCH(request: Request) {
  const { session, error } = await requirePermissionApi("notifications.manage");
  if (error || !session) return error;

  let body: { whatsappEnabled?: unknown; whatsappStart?: unknown; emailAlertsEnabled?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  const wa = body.whatsappEnabled;
  const mail = body.emailAlertsEnabled;
  if (
    (wa !== undefined && typeof wa !== "boolean") ||
    (mail !== undefined && typeof mail !== "boolean") ||
    (wa === undefined && mail === undefined)
  ) {
    return NextResponse.json(
      { error: "whatsappEnabled veya emailAlertsEnabled true/false olmalı" },
      { status: 400 },
    );
  }

  if (typeof wa === "boolean") {
    const before = await whatsappSwitch();
    const startAt = wa && body.whatsappStart === "tomorrow" ? nextMorningStart() : null;
    await setWhatsappEnabled(wa, startAt);
    const when = startAt
      ? ` (${startAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} itibarıyla)`
      : "";
    await audit(session, {
      action: "notification.whatsapp_toggle",
      entity: "notification",
      summary: `WhatsApp bildirimleri ${wa ? "açıldı" : "kapatıldı"}${when}`,
      before: { whatsappEnabled: before.on, startAt: before.startAt },
      after: { whatsappEnabled: wa, startAt: startAt?.toISOString() ?? null },
    });
  }
  if (typeof mail === "boolean") {
    const before = await emailAlertsEnabled();
    await setEmailAlertsEnabled(mail);
    await audit(session, {
      action: "notification.email_toggle",
      entity: "notification",
      summary: `Uyarı e-postaları ${mail ? "açıldı" : "kapatıldı"}`,
      before: { emailAlertsEnabled: before },
      after: { emailAlertsEnabled: mail },
    });
  }
  return NextResponse.json({ ok: true });
}
