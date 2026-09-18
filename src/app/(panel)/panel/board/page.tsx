import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import StatusBoard from "@/components/panel/StatusBoard";
import {
  ensureAgencyBoard,
  serializeBoardCard,
} from "@/lib/panel/board";
import { isStaffRole } from "@/lib/panel/host";
import { prisma } from "@/lib/db";

/** Yalnızca admin.* ajans portalı — marka subdomain’de yok. */
export default async function BoardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const [board, staff, teams, tenants] = await Promise.all([
    ensureAgencyBoard(),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        members: { select: { userId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findMany({
      where: { visible: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = {
    id: board.id,
    name: board.name,
    columns: board.columns.map((col) => ({
      id: col.id,
      name: col.name,
      position: col.position,
      color: col.color,
      cards: col.cards.map((card) => serializeBoardCard(card)),
    })),
  };

  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Durum yükleniyor…</p>}>
      <StatusBoard
        initialBoard={serialized}
        staff={staff}
        teams={teams}
        tenants={tenants}
      />
    </Suspense>
  );
}
