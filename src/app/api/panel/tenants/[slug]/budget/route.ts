import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseBudgetAmount,
  saveBrandBudgetPlan,
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
  campaigns?: CampaignBody[];
  removeCampaigns?: Array<{ provider?: string; campaignId?: string }>;
};

/** Admin/team — marka + kampanya bütçe planı (İstanbul ayı). */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const { slug: raw } = await ctx.params;
  const slug = raw.trim().toLowerCase();
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
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
