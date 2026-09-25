import { after } from "next/server";
import { NextResponse } from "next/server";
import { runScheduledDailySync } from "@/lib/panel/daily-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function cronSecret(): string | null {
  return (
    process.env.CRON_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    null
  );
}

function authorize(request: Request): boolean {
  const expected = cronSecret();
  if (!expected) return false;
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-cron-secret")?.trim() || "";
  return bearer === expected || alt === expected;
}

/**
 * Logolu markalar — günlük Meta + Google kampanya metrikleri.
 * 09:00 / 18:00 İstanbul (Vercel cron UTC 06:00 / 15:00) veya
 * Authorization: Bearer CRON_SECRET ile dış cron.
 */
async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    try {
      await runScheduledDailySync();
    } catch (err) {
      console.error("[cron daily-sync]", err);
    }
  });

  return NextResponse.json({
    ok: true,
    async: true,
    message:
      "Logolu markalar için günlük senkron arka planda başladı (Meta + Google, son 3 gün).",
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
