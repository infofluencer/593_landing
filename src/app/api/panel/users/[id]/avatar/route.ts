import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveStaffAvatar, STAFF_AVATAR_DIR } from "@/lib/panel/staff-avatar";
import { requirePermissionApi, resolveStaffUserId } from "@/lib/panel/staff-auth";
import { deleteUpload } from "@/lib/storage/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

function isUploadBlob(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

/** Admin herkesin, ekip üyesi yalnızca kendi fotoğrafını değiştirebilir. */
async function resolveTarget(ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requirePermissionApi("staff.access");
  if (error || !session) return { error };
  const { id } = await ctx.params;
  const selfId = await resolveStaffUserId(session);
  if (session.user.role !== "admin" && selfId !== id) {
    return {
      error: NextResponse.json(
        { error: "Yalnızca kendi fotoğrafınızı değiştirebilirsiniz" },
        { status: 403 },
      ),
    };
  }
  const user = await prisma.user.findFirst({
    where: { id, role: { in: ["admin", "team"] } },
    select: { id: true },
  });
  if (!user) {
    return {
      error: NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 }),
    };
  }
  return { user };
}

/** POST — profil fotoğrafı yükle (multipart `file`). */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const resolved = await resolveTarget(ctx);
  if (!resolved.user) return resolved.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form verisi gerekli" }, { status: 400 });
  }
  const file = form.get("file");
  if (!isUploadBlob(file) || file.size === 0) {
    return NextResponse.json({ error: "Fotoğraf seçin" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya en fazla 8 MB olabilir" }, { status: 400 });
  }
  if (file.type && !TYPES.has(file.type)) {
    return NextResponse.json({ error: "JPG, PNG, WebP veya GIF yükleyin" }, { status: 400 });
  }

  try {
    const avatarUrl = await saveStaffAvatar(
      resolved.user.id,
      Buffer.from(await file.arrayBuffer()),
    );
    await prisma.user.update({
      where: { id: resolved.user.id },
      data: { avatarUrl },
    });
    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Fotoğraf işlenemedi: ${message}` }, { status: 400 });
  }
}

/** DELETE — fotoğrafı kaldır (baş harflere döner). */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const resolved = await resolveTarget(ctx);
  if (!resolved.user) return resolved.error;
  await deleteUpload(STAFF_AVATAR_DIR, `${resolved.user.id}.webp`);
  await prisma.user.update({
    where: { id: resolved.user.id },
    data: { avatarUrl: null },
  });
  return NextResponse.json({ ok: true, avatarUrl: null });
}
