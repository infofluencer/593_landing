import type { Prisma } from "@prisma/client";
import type { AuditRow } from "@/components/panel/AuditLogTable";
import { prisma } from "@/lib/db";

export type AuditFilter = {
  tenantId?: string;
  actorId?: string;
  entity?: string;
  /** ISO — bu tarihten eski kayıtlar (sayfalama). */
  before?: string;
  take?: number;
};

export async function listAuditLogs(
  filter: AuditFilter,
): Promise<{ rows: AuditRow[]; nextBefore: string | null }> {
  const take = Math.min(Math.max(filter.take ?? 50, 1), 200);
  const where: Prisma.AuditLogWhereInput = {
    ...(filter.tenantId ? { tenantId: filter.tenantId } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(filter.entity ? { entity: filter.entity } : {}),
  };
  const beforeDate = filter.before ? new Date(filter.before) : null;
  if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
    where.createdAt = { lt: beforeDate };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    include: {
      actor: { select: { name: true, email: true } },
      tenant: { select: { slug: true, name: true } },
    },
  });

  const page = logs.slice(0, take);
  return {
    rows: page.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      actor: l.actor?.name || l.actor?.email || l.actorEmail || "Sistem",
      action: l.action,
      summary: l.summary,
      tenant: l.tenant,
      before: l.before,
      after: l.after,
    })),
    nextBefore:
      logs.length > take ? page[page.length - 1].createdAt.toISOString() : null,
  };
}

/** Sorumlu seçimi / filtre için ajans kullanıcıları. */
export async function listStaffOptions() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["admin", "team"] } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users.map((u) => ({ id: u.id, label: u.name || u.email }));
}
