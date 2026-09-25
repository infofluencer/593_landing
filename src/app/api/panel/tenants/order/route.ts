import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/panel/staff-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type PatchBody = {
  slugs?: string[];
};

/** PATCH — ajans marka ızgarası sırası. */
export async function PATCH(request: Request) {
  const { error } = await requireStaffApi();
  if (error) return error;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  if (!Array.isArray(body.slugs) || body.slugs.length === 0) {
    return NextResponse.json({ error: "slugs gerekli" }, { status: 400 });
  }

  const slugs = body.slugs.map((s) => String(s).trim().toLowerCase());
  if (new Set(slugs).size !== slugs.length) {
    return NextResponse.json(
      { error: "Tekrarlayan slug" },
      { status: 400 },
    );
  }

  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, visible: true },
  });
  if (tenants.length !== slugs.length) {
    return NextResponse.json(
      { error: "Geçersiz marka listesi" },
      { status: 400 },
    );
  }

  const visibility = tenants[0]?.visible;
  if (tenants.some((t) => t.visible !== visibility)) {
    return NextResponse.json(
      { error: "Aktif ve devre dışı markalar karışamaz" },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    slugs.map((slug, sortOrder) =>
      prisma.tenant.update({
        where: { slug },
        data: { sortOrder },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
