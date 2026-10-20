import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ContentCalendar from "@/components/panel/ContentCalendar";
import { prisma } from "@/lib/db";
import { listContentPosts } from "@/lib/panel/content-posts";
import { isStaffRole } from "@/lib/panel/host";
import { can } from "@/lib/panel/permissions";

function monthBounds(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  // Takvim ızgarası komşu ayların günlerini de gösterir → ±7 gün pay.
  const from = new Date(Date.UTC(y!, m! - 1, 1) - 7 * 86_400_000);
  const to = new Date(Date.UTC(y!, m!, 0) + 8 * 86_400_000);
  return { from, to };
}

/** Sosyal medya içerik takvimi — yalnızca ajans portalı. */
export default async function ContentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tenant?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");
  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") redirect("/login?error=AccessDenied");

  const sp = await searchParams;
  const now = new Date();
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { from, to } = monthBounds(month);

  const [tenants, staff] = await Promise.all([
    prisma.tenant.findMany({
      where: { visible: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "team"] } },
      select: {
        id: true,
        name: true,
        email: true,
        teamMemberships: { select: { team: { select: { slug: true } } } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);
  const initialTenantId = tenants.find((t) => t.slug === sp.tenant)?.id ?? null;
  const posts = await listContentPosts({ from, to, tenantId: initialTenantId });

  return (
    <ContentCalendar
      month={month}
      initialPosts={posts}
      tenants={tenants}
      staff={staff.map((u) => ({
        id: u.id,
        label: u.name || u.email,
        teams: u.teamMemberships.map((m) => m.team.slug),
      }))}
      initialTenantId={initialTenantId}
      canEdit={can(session.user.role, "brands.edit")}
    />
  );
}
