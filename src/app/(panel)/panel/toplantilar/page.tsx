import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MeetingsManager from "@/components/panel/MeetingsManager";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";
import { meetingInclude, serializeMeeting } from "@/lib/panel/meetings";
import { can } from "@/lib/panel/permissions";
import { resolveStaffUserId } from "@/lib/panel/staff-auth";
import { fixedTeamOrderBy, fixedTeamWhere } from "@/lib/panel/teams";

/** Yalnızca admin.* ajans portalı — marka subdomain’de yok. */
export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; team?: string; new?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const sp = await searchParams;
  const role = session.user.role;

  const [meetings, staff, teams, tenants, selfId] = await Promise.all([
    prisma.meeting.findMany({
      include: meetingInclude,
      orderBy: { startsAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.team.findMany({
      where: fixedTeamWhere,
      orderBy: fixedTeamOrderBy,
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        members: { select: { userId: true } },
      },
    }),
    prisma.tenant.findMany({
      where: { visible: true },
      select: { id: true, name: true, slug: true, ownerId: true },
      orderBy: { name: "asc" },
    }),
    resolveStaffUserId(session),
  ]);

  const initialTenantId =
    tenants.find((t) => t.slug === sp.tenant)?.id ?? null;
  const initialTeamId = teams.find((t) => t.slug === sp.team)?.id ?? null;

  return (
    <MeetingsManager
      initialMeetings={meetings.map(serializeMeeting)}
      staff={staff}
      teams={teams}
      tenants={tenants}
      currentUserId={selfId}
      canManage={can(role, "meetings.manage")}
      canDelete={can(role, "meetings.delete")}
      initialTenantId={initialTenantId}
      initialTeamId={initialTeamId}
      openNew={sp.new === "1"}
    />
  );
}
