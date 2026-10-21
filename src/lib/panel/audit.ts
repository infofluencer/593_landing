import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveStaffUserId } from "@/lib/panel/staff-auth";

export type AuditEntity =
  | "tenant"
  | "budget"
  | "campaign_budget"
  | "user"
  | "team"
  | "board_card"
  | "meeting"
  | "brand_note"
  | "content_post"
  | "report"
  | "alert";

type AuditSession = {
  user: { id?: string | null; email?: string | null };
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  // Decimal / Date → string; JSON kolonuna güvenli.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Yalnızca değişen alanlar — before/after şişmesin. */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): { before: Partial<T>; after: Partial<T> } | null {
  const b = before ?? ({} as T);
  const a = after ?? ({} as T);
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const outBefore: Partial<T> = {};
  const outAfter: Partial<T> = {};
  for (const k of keys) {
    const bv = JSON.stringify(b[k] ?? null);
    const av = JSON.stringify(a[k] ?? null);
    if (bv === av) continue;
    outBefore[k as keyof T] = b[k] as T[keyof T];
    outAfter[k as keyof T] = a[k] as T[keyof T];
  }
  return Object.keys(outAfter).length || Object.keys(outBefore).length
    ? { before: outBefore, after: outAfter }
    : null;
}

/**
 * İşlem kaydı yazar. Asıl işlemi asla bozmaz — hata yalnızca loglanır.
 */
export async function audit(
  session: AuditSession | null | undefined,
  entry: {
    action: string;
    entity: AuditEntity;
    entityId?: string | null;
    tenantId?: string | null;
    summary?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  try {
    const actorId = session ? await resolveStaffUserId(session) : null;
    await prisma.auditLog.create({
      data: {
        actorId,
        actorEmail: session?.user.email?.trim().toLowerCase() || null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        tenantId: entry.tenantId ?? null,
        summary: entry.summary ?? "",
        before: toJson(entry.before),
        after: toJson(entry.after),
      },
    });
  } catch (err) {
    console.error("[audit]", entry.action, err);
  }
}
