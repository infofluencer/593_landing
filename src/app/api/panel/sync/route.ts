import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runAgencySync } from "@/lib/panel/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Admin/team only — Meta provision + Google reads. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "team") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let tenantSlug: string | undefined;
  let siteVerify: boolean | undefined;
  try {
    const body = (await request.json()) as {
      tenantSlug?: string;
      siteVerify?: boolean;
    };
    tenantSlug = body.tenantSlug;
    siteVerify = body.siteVerify;
  } catch {
    // empty body ok
  }

  try {
    const summary = await runAgencySync({ tenantSlug, siteVerify });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
