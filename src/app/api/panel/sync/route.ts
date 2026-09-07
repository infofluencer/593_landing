import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runAgencySync, type SyncProvider } from "@/lib/panel/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function parseProviders(raw: unknown): SyncProvider[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SyncProvider[] = [];
  for (const item of raw) {
    if (item === "meta" || item === "google") out.push(item);
  }
  return out.length ? out : undefined;
}

/** Admin/team only — Meta ve/veya Google sync (tek marka veya toplu). */
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
  let providers: SyncProvider[] | undefined;
  try {
    const body = (await request.json()) as {
      tenantSlug?: string;
      siteVerify?: boolean;
      providers?: unknown;
      /** Tek provider kısayolu: "meta" | "google" */
      provider?: unknown;
    };
    tenantSlug = body.tenantSlug?.trim() || undefined;
    siteVerify = body.siteVerify;
    if (body.provider === "meta" || body.provider === "google") {
      providers = [body.provider];
    } else {
      providers = parseProviders(body.providers);
    }
  } catch {
    // empty body ok
  }

  try {
    const summary = await runAgencySync({ tenantSlug, siteVerify, providers });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
