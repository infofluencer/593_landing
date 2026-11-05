import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import { notifyAlert } from "@/lib/panel/notify";
import { requirePermissionApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

/** POST {alertId} — bekleyen uyarıyı alıcılarına elle iletir (yalnızca admin). */
export async function POST(request: Request) {
  const { session, error } = await requirePermissionApi("notifications.manage");
  if (error || !session) return error;

  let body: { alertId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  const alertId = typeof body.alertId === "string" ? body.alertId : "";
  if (!alertId) {
    return NextResponse.json({ error: "alertId gerekli" }, { status: 400 });
  }

  await notifyAlert(alertId);

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { tenantId: true, type: true, severity: true, notifiedAt: true, notifiedSeverity: true },
  });
  if (!alert) {
    return NextResponse.json({ error: "Uyarı bulunamadı" }, { status: 404 });
  }
  const notified = Boolean(alert.notifiedAt && alert.notifiedSeverity === alert.severity);
  await audit(session, {
    action: "notification.manual_send",
    entity: "notification",
    entityId: alertId,
    tenantId: alert.tenantId,
    summary: `Elle bildirim (${alert.type}): ${notified ? "iletildi" : "iletilemedi"}`,
  });
  return NextResponse.json({ ok: true, notified });
}
