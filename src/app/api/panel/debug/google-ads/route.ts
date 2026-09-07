import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { diagnoseGoogleAdsAuth } from "@/lib/integrations/google/ads";

export const runtime = "nodejs";

/** Staff-only — production Google Ads auth check (no secrets returned). */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "team") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await diagnoseGoogleAdsAuth();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
