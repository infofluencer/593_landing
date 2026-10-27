import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import BackupManager from "@/components/panel/BackupManager";
import { listBackups } from "@/lib/panel/backup";
import { isStaffRole } from "@/lib/panel/host";
import { can } from "@/lib/panel/permissions";
import { s3Enabled } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

/** Yedekler — yalnızca admin. */
export default async function BackupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/");

  const h = await headers();
  if (h.get("x-panel-mode") !== "staff") {
    redirect("/login?error=AccessDenied");
  }
  if (!can(session.user.role, "backups.manage")) redirect("/brands");

  const backups = await listBackups();
  return <BackupManager initial={backups} s3={s3Enabled()} />;
}
