import { after } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isBackfillRunning,
  listBackfillStatus,
  runConversionBackfill,
} from "@/lib/panel/backfill";
import { can } from "@/lib/panel/permissions";

export const runtime = "nodejs";
export const maxDuration = 300;

async function authorize() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "brands.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Marka bazında backfill durumu (UI poll). */
export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  return NextResponse.json({
    running: await isBackfillRunning(),
    tenants: await listBackfillStatus(),
  });
}

/**
 * Geriye dönük doldurmayı arka planda başlat (after) — markalar sırayla.
 * Body: { force?: boolean, slugs?: string[] }
 */
export async function POST(request: Request) {
  const denied = await authorize();
  if (denied) return denied;

  let force = false;
  let slugs: string[] | undefined;
  try {
    const body = (await request.json()) as { force?: boolean; slugs?: unknown };
    force = body.force === true;
    if (Array.isArray(body.slugs)) {
      slugs = body.slugs.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // empty body ok
  }

  if (await isBackfillRunning()) {
    return NextResponse.json(
      { error: "Geriye dönük doldurma zaten çalışıyor." },
      { status: 409 },
    );
  }

  after(async () => {
    try {
      await runConversionBackfill({ force, slugs });
    } catch (err) {
      console.error(
        "[backfill]",
        err instanceof Error ? err.message : String(err),
      );
    }
  });

  return NextResponse.json({
    ok: true,
    message:
      "Geriye dönük doldurma arka planda başladı — markalar sırayla işlenir.",
  });
}
