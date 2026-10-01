import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseBudgetAmount,
  saveBrandBudgetPlan,
  saveBrandBudgetYear,
  type BudgetProvider,
} from "@/lib/panel/brand-budget";
import { requireStaffApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

type CampaignBody = {
  provider?: string;
  campaignId?: string;
  campaignName?: string;
  label?: string | null;
  audience?: string | null;
  location?: string | null;
  monthlyBudget?: unknown;
  dailyBudget?: unknown;
};

type PatchBody = {
  month?: string;
  monthlyBudget?: unknown;
  dailyBudget?: unknown;
  googleBudget?: unknown;
  metaBudget?: unknown;
  note?: unknown;
  campaigns?: CampaignBody[];
  removeCampaigns?: Array<{ provider?: string; campaignId?: string }>;
};

type PutBody = {
  months?: Array<{
    month?: string;
    monthlyBudget?: unknown;
    googleBudget?: unknown;
    metaBudget?: unknown;
  }>;
};

async function findTenant(ctx: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await ctx.params;
  const slug = raw.trim().toLowerCase();
  return prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
}

/** Admin/team — marka + kampanya bütçe planı (İstanbul ayı). */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const tenant = await findTenant(ctx);
  if (!tenant) {
    return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }

  const month = body.month?.trim() ?? "";
  if (!month) {
    return NextResponse.json({ error: "Ay gerekli" }, { status: 400 });
  }

  try {
    const campaigns = Array.isArray(body.campaigns) ? body.campaigns : [];
    await saveBrandBudgetPlan(tenant.id, {
      month,
      monthlyBudget: parseBudgetAmount(body.monthlyBudget),
      dailyBudget: parseBudgetAmount(body.dailyBudget),
      googleBudget: parseBudgetAmount(body.googleBudget),
      metaBudget: parseBudgetAmount(body.metaBudget),
      note: typeof body.note === "string" ? body.note : "",
      campaigns: campaigns.map((row) => ({
        provider: row.provider as BudgetProvider,
        campaignId: row.campaignId ?? "",
        campaignName: row.campaignName,
        label: typeof row.label === "string" ? row.label : "",
        audience: typeof row.audience === "string" ? row.audience : "",
        location: typeof row.location === "string" ? row.location : "",
        monthlyBudget: parseBudgetAmount(row.monthlyBudget),
        dailyBudget: parseBudgetAmount(row.dailyBudget),
      })),
      removeCampaigns: Array.isArray(body.removeCampaigns)
        ? body.removeCampaigns.map((row) => ({
            provider: row.provider as BudgetProvider,
            campaignId: row.campaignId ?? "",
          }))
        : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kaydedilemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/** Admin/team — yıllık plan: birden fazla ayın toplam + kanal payı. */
export async function PUT(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const tenant = await findTenant(ctx);
  if (!tenant) {
    return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "JSON gerekli" }, { status: 400 });
  }
  if (!Array.isArray(body.months) || body.months.length === 0) {
    return NextResponse.json({ error: "Ay listesi gerekli" }, { status: 400 });
  }
  if (body.months.length > 24) {
    return NextResponse.json({ error: "En fazla 24 ay" }, { status: 400 });
  }

  try {
    await saveBrandBudgetYear(
      tenant.id,
      body.months.map((row) => ({
        month: row.month?.trim() ?? "",
        monthlyBudget: parseBudgetAmount(row.monthlyBudget),
        googleBudget: parseBudgetAmount(row.googleBudget),
        metaBudget: parseBudgetAmount(row.metaBudget),
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kaydedilemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
