import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  BRAND_COVER_MAX_BYTES,
  BRAND_COVER_TYPES,
  deleteBrandCoverFile,
  saveBrandCover,
} from "@/lib/panel/brand-cover";

export const runtime = "nodejs";

async function requireStaffTenant(slug: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "admin" && session.user.role !== "team") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, coverUrl: true },
  });
  if (!tenant) {
    return { error: NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 }) };
  }
  return { tenant };
}

/** Admin/team — kare kapak yükle (1024×1024 WebP). */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const resolved = await requireStaffTenant(slug.trim().toLowerCase());
  if ("error" in resolved && resolved.error) return resolved.error;
  const tenant = resolved.tenant!;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Form verisi gerekli" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Fotoğraf seçin" }, { status: 400 });
  }
  if (file.size > BRAND_COVER_MAX_BYTES) {
    return NextResponse.json(
      { error: "Dosya en fazla 8 MB olabilir" },
      { status: 400 },
    );
  }
  if (file.type && !BRAND_COVER_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "JPG, PNG, WebP veya GIF yükleyin" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const coverUrl = await saveBrandCover(tenant.id, buffer);
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { coverUrl },
      select: { slug: true, coverUrl: true },
    });
    return NextResponse.json({ ok: true, coverUrl: updated.coverUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Kapak işlenemedi: ${message}` },
      { status: 400 },
    );
  }
}

/** Admin/team — yüklenen kapağı sil (statik logo yedeğe döner). */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const resolved = await requireStaffTenant(slug.trim().toLowerCase());
  if ("error" in resolved && resolved.error) return resolved.error;
  const tenant = resolved.tenant!;

  try {
    await deleteBrandCoverFile(tenant.id);
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { coverUrl: null },
    });
    return NextResponse.json({ ok: true, coverUrl: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
