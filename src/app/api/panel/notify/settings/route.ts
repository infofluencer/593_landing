import { NextResponse } from "next/server";
import { audit } from "@/lib/panel/audit";
import { setWhatsappEnabled, whatsappEnabled } from "@/lib/panel/notification-settings";
import { requirePermissionApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

/** PATCH {whatsappEnabled} — WhatsApp ana anahtarı (yalnızca admin). */
export async function PATCH(request: Request) {
  const { session, error } = await requirePermissionApi("notifications.manage");
  if (error || !session) return error;

  let body: { whatsappEnabled?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  if (typeof body.whatsappEnabled !== "boolean") {
    return NextResponse.json({ error: "whatsappEnabled true/false olmalı" }, { status: 400 });
  }

  const before = await whatsappEnabled();
  await setWhatsappEnabled(body.whatsappEnabled);
  await audit(session, {
    action: "notification.whatsapp_toggle",
    entity: "notification",
    summary: `WhatsApp bildirimleri ${body.whatsappEnabled ? "açıldı" : "kapatıldı"}`,
    before: { whatsappEnabled: before },
    after: { whatsappEnabled: body.whatsappEnabled },
  });
  return NextResponse.json({ ok: true, whatsappEnabled: body.whatsappEnabled });
}
