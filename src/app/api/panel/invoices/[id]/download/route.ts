import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolvePanelTenant } from "@/lib/panel/data";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import {
  downloadGoogleInvoicePdf,
  fetchGoogleInvoicePdfUrl,
} from "@/lib/integrations/google/billing";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const h = await headers();
  const slug = h.get("x-tenant-slug");
  if (!slug) {
    return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  }

  const tenant = await resolvePanelTenant(slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const ok =
    session.user.tenantIds.includes(tenant.id) ||
    (
      await prisma.tenant.findMany({
        where: { id: { in: session.user.tenantIds } },
        select: { slug: true },
      })
    ).some((t) => t.slug === slug);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const charge = await prisma.billingCharge.findFirst({
    where: { id, tenantId: tenant.id },
  });
  if (!charge) {
    return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });
  }

  if (charge.provider === "meta") {
    if (!charge.viewUrl) {
      return NextResponse.json(
        { error: "Meta makbuz linki yok" },
        { status: 404 },
      );
    }
    return NextResponse.redirect(charge.viewUrl);
  }

  const adsCustomerId = resolveAdsCustomerId({
    slug: tenant.slug,
    name: tenant.name,
    mapping: tenant.mapping,
  });
  if (
    !adsCustomerId ||
    !charge.billingSetupId ||
    !charge.issueYear ||
    !charge.issueMonth
  ) {
    return NextResponse.json(
      { error: "Google fatura indirme bilgisi eksik" },
      { status: 409 },
    );
  }

  try {
    const pdfUrl = await fetchGoogleInvoicePdfUrl({
      customerId: adsCustomerId,
      billingSetupId: charge.billingSetupId,
      issueYear: charge.issueYear,
      issueMonth: charge.issueMonth,
      invoiceId: charge.externalId,
    });
    if (!pdfUrl) {
      return NextResponse.json(
        { error: "PDF URL alınamadı (aylık faturalama olmayabilir)" },
        { status: 404 },
      );
    }
    const buf = await downloadGoogleInvoicePdf(pdfUrl);
    const filename = `google-invoice-${charge.invoiceNumber || charge.externalId}.pdf`;
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
