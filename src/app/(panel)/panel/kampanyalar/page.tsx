import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ActiveCampaignsBoard from "@/components/panel/ActiveCampaignsBoard";
import { loadActiveCampaigns } from "@/lib/panel/active-campaigns";
import { isStaffRole } from "@/lib/panel/host";
import { resolvePanelDateRange } from "@/lib/panel/period";

export const dynamic = "force-dynamic";

/** Kampanyalar — tüm markaların reklam setleri ve kampanyaları; yalnızca ajans portalı. */
export default async function ActiveCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const range = await resolvePanelDateRange(await searchParams);
  const snapshot = await loadActiveCampaigns({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  return <ActiveCampaignsBoard snapshot={snapshot} rangeLabel={range.label} />;
}
