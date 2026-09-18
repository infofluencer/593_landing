import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TeamManager from "@/components/panel/TeamManager";
import { isStaffRole } from "@/lib/panel/host";
import { prisma } from "@/lib/db";

/** Yalnızca admin.* ajans portalı — marka subdomain’de yok. */
export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const [teams, staff] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordPlain: true,
        teamMemberships: {
          select: {
            teamId: true,
            team: { select: { id: true, name: true, slug: true, color: true } },
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
    }),
  ]);

  return (
    <TeamManager
      initialTeams={teams}
      initialStaff={staff}
      canManageMembers={session.user.role === "admin"}
    />
  );
}
