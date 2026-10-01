import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TeamManager from "@/components/panel/TeamManager";
import { isStaffRole } from "@/lib/panel/host";
import { can, permissionMatrix } from "@/lib/panel/permissions";
import { resolveStaffUserId } from "@/lib/panel/staff-auth";
import {
  fixedTeamOrderBy,
  fixedTeamWhere,
  staffSelect,
  teamInclude,
} from "@/lib/panel/teams";
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

  const role = session.user.role;
  const [teams, staff, selfId] = await Promise.all([
    prisma.team.findMany({
      where: fixedTeamWhere,
      orderBy: fixedTeamOrderBy,
      include: teamInclude,
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: staffSelect(can(role, "users.viewPasswords")),
      orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
    }),
    resolveStaffUserId(session),
  ]);

  return (
    <TeamManager
      initialTeams={teams}
      initialStaff={staff}
      currentUserId={selfId}
      canManageUsers={can(role, "users.manage")}
      canManageMembers={can(role, "teams.manageMembers")}
      permissions={permissionMatrix()}
    />
  );
}
