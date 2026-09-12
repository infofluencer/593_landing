import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Poll panel sync sentinel job (service=panel_sync, objective=run).
 * Query: ?tenantSlug=zeynep-ozel&provider=meta
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "team") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug")?.trim() || "";
  const providerRaw = url.searchParams.get("provider")?.trim() || "meta";
  const provider =
    providerRaw === "google" || providerRaw === "meta" ? providerRaw : "meta";

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug gerekli" },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    return NextResponse.json(
      { error: `Marka bulunamadı: ${tenantSlug}` },
      { status: 404 },
    );
  }

  const panelJob = await prisma.syncJob.findUnique({
    where: {
      tenantId_provider_service_objective: {
        tenantId: tenant.id,
        provider,
        service: "panel_sync",
        objective: "run",
      },
    },
  });

  const related = await prisma.syncJob.findMany({
    where: {
      tenantId: tenant.id,
      provider,
      service: { not: "panel_sync" },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  return NextResponse.json({
    ok: true,
    tenantSlug: tenant.slug,
    provider,
    status: panelJob?.status ?? "idle",
    error: panelJob?.error ?? null,
    updatedAt: panelJob?.updatedAt?.toISOString() ?? null,
    jobs: related.map((j) => ({
      service: j.service,
      objective: j.objective,
      status: j.status,
      error: j.error,
      lastSuccessAt: j.lastSuccessAt?.toISOString() ?? null,
    })),
  });
}
