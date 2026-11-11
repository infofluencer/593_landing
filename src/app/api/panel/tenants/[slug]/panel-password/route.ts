import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/panel/permissions";

export const runtime = "nodejs";

/**
 * Staff — markanın müşteri panel şifresi. Sayfa payload'ına gömülmez;
 * yalnızca "göster" / "kopyala" anında istenir.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "brands.viewPanelPassword")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  const membership = await prisma.membership.findFirst({
    where: { tenant: { slug }, user: { role: "client" } },
    select: { user: { select: { passwordPlain: true } } },
  });

  return NextResponse.json(
    { password: membership?.user.passwordPlain ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
