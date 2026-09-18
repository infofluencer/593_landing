import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";

/** Staff-only API guard (admin/team on agency portal). */
export async function requireStaffApi() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isStaffRole(session.user.role)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

/**
 * JWT’deki id DB’de yoksa (reseed sonrası) e-posta ile çöz.
 * FK için güvenli User.id döner; bulunamazsa null.
 */
export async function resolveStaffUserId(session: {
  user: { id?: string | null; email?: string | null };
}): Promise<string | null> {
  const id = session.user.id?.trim();
  if (id) {
    const byId = await prisma.user.findFirst({
      where: { id, role: { in: ["admin", "team"] } },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  const email = session.user.email?.trim().toLowerCase();
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { email, role: { in: ["admin", "team"] } },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  return null;
}
