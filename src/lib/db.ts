import {
  PrismaClient,
  type Role,
  type Tenant,
  type TenantType,
} from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!slug) return null;
  return prisma.tenant.findUnique({ where: { slug } });
}

export async function getTenantWithMapping(slug: string) {
  if (!slug) return null;
  return prisma.tenant.findUnique({
    where: { slug },
    include: { mapping: true, thresholds: true },
  });
}

export class TenantAccessError extends Error {
  constructor(message = "Bu markaya erişim yetkiniz yok.") {
    super(message);
    this.name = "TenantAccessError";
  }
}

/**
 * Brand subdomain access: membership for that tenant only.
 * Admin/team use the staff host (admin.*), not marka subdomains.
 */
export function assertTenantAccess(
  tenantIds: readonly string[],
  tenantId: string,
): void {
  if (tenantIds.includes(tenantId)) return;
  throw new TenantAccessError();
}

export function isEcommerce(type: TenantType): boolean {
  return type === "ecommerce";
}

export function isLead(type: TenantType): boolean {
  return type === "lead";
}

export type SessionAccess = {
  role: Role;
  tenantIds: string[];
};
