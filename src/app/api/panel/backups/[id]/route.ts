import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/panel/audit";
import {
  backupFileName,
  backupSelect,
  deleteBackup,
  readBackup,
  serializeBackup,
} from "@/lib/panel/backup";
import { requirePermissionApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

const ID_RE = /^[a-z0-9]+$/i;

/** GET — yedek dosyasını indir (admin). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermissionApi("backups.manage");
  if (error) return error;

  const { id } = await ctx.params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
  }
  const row = await prisma.backup.findUnique({
    where: { id },
    select: backupSelect,
  });
  const buf = row ? await readBackup(id) : null;
  if (!row || !buf) {
    return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
  }
  const name = backupFileName(serializeBackup(row));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** DELETE — yedeği sil (admin). */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermissionApi("backups.manage");
  if (error || !session) return error;

  const { id } = await ctx.params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
  }
  try {
    const removed = await deleteBackup(id);
    if (!removed) {
      return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
    }
    await audit(session, {
      action: "backup.delete",
      entity: "backup",
      entityId: id,
      summary: "Yedek silindi",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
