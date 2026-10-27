import { NextResponse } from "next/server";
import { audit } from "@/lib/panel/audit";
import { createBackup, listBackups } from "@/lib/panel/backup";
import {
  requirePermissionApi,
  resolveStaffUserId,
} from "@/lib/panel/staff-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET — yedek listesi (admin). */
export async function GET() {
  const { error } = await requirePermissionApi("backups.manage");
  if (error) return error;
  return NextResponse.json({ backups: await listBackups() });
}

/** POST — şimdi yedek al (admin). */
export async function POST() {
  const { session, error } = await requirePermissionApi("backups.manage");
  if (error || !session) return error;

  try {
    const backup = await createBackup({
      trigger: "manual",
      createdById: await resolveStaffUserId(session),
      createdByEmail: session.user.email,
    });
    await audit(session, {
      action: "backup.create",
      entity: "backup",
      entityId: backup.id,
      summary: `Yedek alındı (${backup.counts.cards ?? 0} kart)`,
      after: backup.counts,
    });
    return NextResponse.json({ ok: true, backup });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Yedek alınamadı: ${message}` },
      { status: 500 },
    );
  }
}
