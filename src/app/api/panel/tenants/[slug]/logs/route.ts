import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listAuditLogs } from "@/lib/panel/audit-query";
import { classifySyncError } from "@/lib/panel/brand-table";
import { requireStaffApi } from "@/lib/panel/staff-auth";
import { describeCall } from "@/lib/panel/sync-audit";

export const runtime = "nodejs";

const MAX_DAYS = 60;
const MAX_RUNS = 500;

/** Sentinel / kilit satırları — gerçek API çağrısı değil. */
const META_SERVICES = new Set(["panel_sync", "cron"]);

/** Staff — marka senkron logu (servis durumu + çekim geçmişi + alarmlar + işlemler). */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const { slug: raw } = await ctx.params;
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });
  }

  const daysParam = Number(new URL(request.url).searchParams.get("days"));
  const days =
    Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.round(daysParam), MAX_DAYS)
      : 14;
  const since = new Date(Date.now() - days * 86_400_000);

  const [jobs, runs, alerts, audit] = await Promise.all([
    prisma.syncJob.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ provider: "asc" }, { service: "asc" }],
    }),
    prisma.syncRun.findMany({
      where: { tenantId: tenant.id, finishedAt: { gte: since } },
      orderBy: { finishedAt: "desc" },
      take: MAX_RUNS,
    }),
    prisma.alert.findMany({
      where: { tenantId: tenant.id, resolved: false },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        type: true,
        severity: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    listAuditLogs({ tenantId: tenant.id, take: 15 }),
  ]);

  const label = (provider: string, service: string, objective: string) => {
    const p = provider === "google" ? "google" : "meta";
    return describeCall(p, service, objective);
  };

  return NextResponse.json({
    days,
    since: since.toISOString(),
    jobs: jobs
      .filter((j) => !META_SERVICES.has(j.service))
      .map((j) => ({
        key: `${j.provider}:${j.service}:${j.objective}`,
        provider: j.provider,
        service: j.service,
        objective: j.objective,
        ...label(j.provider, j.service, j.objective),
        status: j.status,
        lastSuccessAt: j.lastSuccessAt?.toISOString() ?? null,
        lastErrorAt: j.lastErrorAt?.toISOString() ?? null,
        updatedAt: j.updatedAt.toISOString(),
        error: j.status === "error" ? j.error : null,
        errorClass: j.status === "error" ? classifySyncError(j.error) : null,
      })),
    runs: runs.map((r) => ({
      id: r.id,
      key: `${r.provider}:${r.service}:${r.objective}`,
      provider: r.provider,
      service: r.service,
      objective: r.objective,
      ...label(r.provider, r.service, r.objective),
      status: r.status,
      error: r.error,
      errorClass: r.status === "error" ? classifySyncError(r.error) : null,
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt.toISOString(),
      durationMs: r.durationMs,
      trigger: r.trigger,
      actorEmail: r.actorEmail,
      attempts: r.attempts,
    })),
    truncated: runs.length === MAX_RUNS,
    alerts: alerts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    audit: audit.rows,
  });
}
