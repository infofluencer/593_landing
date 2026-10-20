import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidYmd } from "@/lib/date/tr";
import { audit, diffFields } from "@/lib/panel/audit";
import { buildBrandReport, sendBrandReport } from "@/lib/panel/brand-report";
import {
  requirePermissionApi,
  requireStaffApi,
  resolveStaffUserId,
} from "@/lib/panel/staff-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ slug: string }> };

function cleanSlug(raw: string) {
  return decodeURIComponent(raw).trim().toLowerCase();
}

function rangeFrom(params: URLSearchParams | Record<string, unknown>) {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) : (params[k] as string | undefined);
  const from = String(get("from") ?? "");
  const to = String(get("to") ?? "");
  if (!isValidYmd(from) || !isValidYmd(to) || from > to) return null;
  return { from, to };
}

/** GET ?from&to&comment — PDF indir. */
export async function GET(request: Request, ctx: Ctx) {
  const { session, error } = await requireStaffApi();
  if (error || !session) return error;
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const range = rangeFrom(url.searchParams);
  if (!range) return NextResponse.json({ error: "from / to (YYYY-MM-DD) gerekli" }, { status: 400 });
  try {
    const built = await buildBrandReport({
      slug: cleanSlug(slug),
      ...range,
      comment: url.searchParams.get("comment") ?? "",
    });
    return new NextResponse(Buffer.from(built.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${built.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** POST {from,to,comment} — e-posta ile gönder. */
export async function POST(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  const { slug } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  const range = rangeFrom(body);
  if (!range) return NextResponse.json({ error: "from / to (YYYY-MM-DD) gerekli" }, { status: 400 });
  const actorId = await resolveStaffUserId(session);
  try {
    const r = await sendBrandReport({
      slug: cleanSlug(slug),
      ...range,
      comment: String(body.comment ?? ""),
      trigger: "manual",
      actor: { id: actorId, email: session.user.email ?? null },
    });
    await audit(session, {
      action: "report.send",
      entity: "report",
      entityId: r.reportId,
      summary: r.error ? `Rapor gönderilemedi: ${r.error}` : `Rapor gönderildi: ${r.sentTo.join(", ")}`,
      after: { ...range, sentTo: r.sentTo },
    });
    if (r.error) return NextResponse.json({ error: r.error, reportId: r.reportId }, { status: 502 });
    return NextResponse.json({ ok: true, sentTo: r.sentTo, reportId: r.reportId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** PATCH {reportFrequency, reportEmails[]} — otomatik rapor ayarı. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, error } = await requirePermissionApi("brands.edit");
  if (error || !session) return error;
  const { slug } = await ctx.params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: cleanSlug(slug) },
    select: { id: true, name: true, reportFrequency: true, reportEmails: true },
  });
  if (!tenant) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });
  let body: { reportFrequency?: string; reportEmails?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  const frequency =
    body.reportFrequency === "weekly" || body.reportFrequency === "monthly"
      ? body.reportFrequency
      : "none";
  const emails = Array.isArray(body.reportEmails)
    ? [...new Set(body.reportEmails.map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]
    : tenant.reportEmails;
  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { reportFrequency: frequency, reportEmails: emails },
    select: { reportFrequency: true, reportEmails: true },
  });
  const diff = diffFields(
    { reportFrequency: tenant.reportFrequency, reportEmails: tenant.reportEmails },
    { reportFrequency: updated.reportFrequency, reportEmails: updated.reportEmails },
  );
  if (diff) {
    await audit(session, {
      action: "tenant.report_settings",
      entity: "tenant",
      entityId: tenant.id,
      tenantId: tenant.id,
      summary: `${tenant.name}: rapor ayarı güncellendi`,
      before: diff.before,
      after: diff.after,
    });
  }
  return NextResponse.json({ ok: true, ...updated });
}
