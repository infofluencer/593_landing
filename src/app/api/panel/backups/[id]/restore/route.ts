import { NextResponse } from "next/server";
import { audit } from "@/lib/panel/audit";
import { restoreBoardFromBackup } from "@/lib/panel/backup";
import { requirePermissionApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ID_RE = /^[a-z0-9]+$/i;

/**
 * POST — durum panosunu yedekten geri yükle (admin).
 * Yalnızca eksik kolon / kartları ekler; mevcut kayıtlara dokunmaz.
 */
export async function POST(
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
    const result = await restoreBoardFromBackup(id);
    await audit(session, {
      action: "backup.restore",
      entity: "backup",
      entityId: id,
      summary: `Pano yedekten geri yüklendi (${result.createdCards} kart eklendi)`,
      after: result,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Geri yüklenemedi: ${message}` },
      { status: 400 },
    );
  }
}
