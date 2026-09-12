import { after } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { runAgencySync, type SyncProvider } from "@/lib/panel/sync";
import { upsertSyncJob } from "@/lib/panel/sync-job";

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

/**
 * Meta/Google sync — Traefik ~20s 504 verdiği için iş `after()` ile arka planda.
 * İstemci `/api/panel/sync/status` ile poll eder.
 */
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

  const resolvedProviders: SyncProvider[] = providers?.length
    ? providers
    : ["meta", "google"];

  // Sentinel job(s) so the UI can poll immediately (before heavy Meta calls).
  const tenants = await prisma.tenant.findMany({
    where: {
      visible: true,
      ...(tenantSlug ? { slug: tenantSlug } : {}),
    },
    select: { id: true, slug: true },
  });

  if (tenantSlug && tenants.length === 0) {
    return NextResponse.json(
      {
        error: `Marka bulunamadı: ${tenantSlug} (slug değişmiş olabilir — sayfayı yenile).`,
      },
      { status: 404 },
    );
  }

  for (const t of tenants) {
    for (const provider of resolvedProviders) {
      await upsertSyncJob({
        tenantId: t.id,
        provider,
        service: "panel_sync",
        objective: "run",
        status: "running",
        error: null,
      });
    }
  }

  after(async () => {
    try {
      const summary = await runAgencySync({
        tenantSlug,
        siteVerify,
        providers: resolvedProviders,
      });
      for (const t of tenants) {
        for (const provider of resolvedProviders) {
          const tenantSummary = summary.tenants.find((x) => x.slug === t.slug);
          const failed = tenantSummary
            ? Object.values(tenantSummary.services).some((s) => s && !s.ok)
            : false;
          const firstErr = tenantSummary
            ? Object.values(tenantSummary.services).find((s) => s && !s.ok)
                ?.error
            : null;
          await upsertSyncJob({
            tenantId: t.id,
            provider,
            service: "panel_sync",
            objective: "run",
            status: failed ? "error" : "success",
            error: failed ? firstErr || "kısmi hata" : null,
            markSuccess: !failed,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[panel sync]", message);
      for (const t of tenants) {
        for (const provider of resolvedProviders) {
          await upsertSyncJob({
            tenantId: t.id,
            provider,
            service: "panel_sync",
            objective: "run",
            status: "error",
            error: message,
          });
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    async: true,
    tenantSlug: tenantSlug ?? null,
    providers: resolvedProviders,
    message:
      "Senkron arka planda başladı. Proxy timeout’a takılmaz; birkaç dakika sürebilir.",
  });
}
