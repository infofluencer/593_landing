import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { resolvePanelTenant } from "@/lib/panel/data";
import { buildTenantReportCsv } from "@/lib/panel/export";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const h = await headers();
  const slug = h.get("x-tenant-slug");
  if (!slug) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }

  const tenant = await resolvePanelTenant(slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (session.user.role === "client") {
    const ok =
      session.user.tenantIds.includes(tenant.id) ||
      (
        await prisma.tenant.findMany({
          where: { id: { in: session.user.tenantIds } },
          select: { slug: true },
        })
      ).some((t) => t.slug === slug);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Prefer DB id; mock-only tenants won't have rows — return 409
  const db = await prisma.tenant.findUnique({ where: { slug } });
  if (!db) {
    return NextResponse.json(
      { error: "Canlı DB kaydı yok — önce sync veya seed çalıştırın." },
      { status: 409 },
    );
  }

  const csv = await buildTenantReportCsv(db.id);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="593-${slug}-report.csv"`,
    },
  });
}
