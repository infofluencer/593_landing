import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolvePanelTenant } from "@/lib/panel/data";
import { verifyTenantSite } from "@/lib/panel/verify-tenant-site";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Admin/team — Playwright site tag verification for current tenant. */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "team") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const h = await headers();
  const slug = h.get("x-tenant-slug");
  if (!slug) {
    return NextResponse.json({ error: "Tenant host gerekli" }, { status: 400 });
  }

  const tenant = await resolvePanelTenant(slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 404 });
  }

  // Prefer DB id when available
  const db = await prisma.tenant.findUnique({ where: { slug } });
  const tenantId = db?.id ?? tenant.id;
  if (!db) {
    return NextResponse.json(
      {
        error:
          "Site testi için DB’de tenant gerekir (önce Meta provision / seed).",
      },
      { status: 400 },
    );
  }

  try {
    const result = await verifyTenantSite({ tenantId });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
