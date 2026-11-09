import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import OfficeShiftBoard from "@/components/panel/OfficeShiftBoard";
import { getIstanbulTodayYmd } from "@/lib/date/now";
import { isStaffRole } from "@/lib/panel/host";
import { loadOfficeShiftBoard } from "@/lib/panel/office-shifts";
import { resolveStaffUserId } from "@/lib/panel/staff-auth";

export const dynamic = "force-dynamic";

/** Yalnızca admin.* ajans portalı — kişi bazlı ofis günleri. */
export default async function OfficeShiftPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const [todayYmd, selfId] = await Promise.all([
    getIstanbulTodayYmd(),
    resolveStaffUserId(session),
  ]);

  const data = await loadOfficeShiftBoard({
    todayYmd,
    currentUserId: selfId,
  });

  return <OfficeShiftBoard data={data} />;
}
