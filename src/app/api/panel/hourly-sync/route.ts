import { after, NextResponse } from "next/server";
import { getHourlySyncState, runLockedHourlySync } from "@/lib/panel/hourly-sync";
import { requirePermissionApi, requireStaffApi } from "@/lib/panel/staff-auth";
import { runWithSyncContext } from "@/lib/panel/sync-context";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Staff — saatlik senkronun son durumu (istemci poll eder). */
export async function GET() {
  const { error } = await requireStaffApi();
  if (error) return error;
  return NextResponse.json(await getHourlySyncState());
}

/** Staff — bugünün saatlik harcaması + ödeme durumunu şimdi çek (arka planda). */
export async function POST() {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;

  const state = await getHourlySyncState();
  if (state.running) {
    return NextResponse.json({ ok: true, alreadyRunning: true, state });
  }
  const ctx = {
    trigger: "manual" as const,
    actorEmail: session.user.email?.trim().toLowerCase() || null,
  };
  after(() =>
    runWithSyncContext(ctx, () => runLockedHourlySync()).catch((err) =>
      console.error("[hourly-sync manual]", err),
    ),
  );
  return NextResponse.json({ ok: true, started: true });
}
