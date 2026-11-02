import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ActiveCampaignsBoard from "@/components/panel/ActiveCampaignsBoard";
import { loadActiveCampaigns } from "@/lib/panel/active-campaigns";
import { isStaffRole } from "@/lib/panel/host";

export const dynamic = "force-dynamic";

/** Aktif kampanyalar — tüm markaların yayındaki kampanyaları; yalnızca ajans portalı. */
export default async function ActiveCampaignsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const snapshot = await loadActiveCampaigns();
  return <ActiveCampaignsBoard snapshot={snapshot} />;
}
