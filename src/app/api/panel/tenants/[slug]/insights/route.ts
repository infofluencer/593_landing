import { NextResponse } from "next/server";
import { getIstanbulTodayYmd } from "@/lib/date/now";
import { addDaysYmd } from "@/lib/date/tr";
import { getTenantBundle } from "@/lib/panel/data";
import type { MockCampaignMetric } from "@/lib/panel/mock-data";
import { requireStaffApi } from "@/lib/panel/staff-auth";

export const runtime = "nodejs";

const ALLOWED_DAYS = [7, 30, 90] as const;

type ChannelKpi = {
  spend: number;
  impr: number;
  clicks: number;
  conv: number;
  convValue: number;
};

function kpi(m: MockCampaignMetric | undefined): ChannelKpi {
  return {
    spend: m?.spend ?? 0,
    impr: m?.impr ?? 0,
    clicks: m?.clicks ?? 0,
    conv: m?.conv ?? 0,
    convValue: m?.convValue ?? 0,
  };
}

/**
 * Staff — marka performans grafikleri: dönem / önceki dönem KPI, günlük
 * harcama + dönüşüm, kampanya kırılımı. Sayılar panel KPI'larıyla aynı kaynaktan.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { error } = await requireStaffApi();
  if (error) return error;

  const { slug: raw } = await ctx.params;
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  const daysParam = Number(new URL(request.url).searchParams.get("days"));
  const days = (ALLOWED_DAYS as readonly number[]).includes(daysParam)
    ? daysParam
    : 30;

  const today = await getIstanbulTodayYmd();
  const from = addDaysYmd(today, -(days - 1));
  const bundle = await getTenantBundle(slug, { from, to: today });
  if (!bundle) {
    return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 });
  }

  // Eksik günler 0 — grafik ekseni kesintisiz kalsın.
  const byDate = new Map(bundle.dailySpend.map((d) => [d.date, d]));
  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDaysYmd(from, i);
    const d = byDate.get(date);
    return {
      date,
      metaSpend: d?.meta ?? 0,
      googleSpend: d?.google ?? 0,
      metaConv: d?.metaConv ?? 0,
      googleConv: d?.googleConv ?? 0,
    };
  });

  // Platform başına ilk 10 — panelde platform filtresi tek kanala daralabiliyor.
  const top = <T extends MockCampaignMetric>(list: T[]) =>
    list
      .filter((c) => c.spend > 0 || c.conv > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);
  const campaigns = [
    ...top(bundle.metaCurrent.campaigns).map((c) => ({ ...c, provider: "meta" as const })),
    ...top(bundle.current.campaigns).map((c) => ({ ...c, provider: "google" as const })),
  ]
    .sort((a, b) => b.spend - a.spend)
    .map((c) => ({
      name: c.campaign,
      provider: c.provider,
      spend: c.spend,
      conv: c.conv,
      clicks: c.clicks,
      impr: c.impr,
    }));

  return NextResponse.json({
    days,
    from,
    to: today,
    type: bundle.tenant.type,
    currency: bundle.tenant.currency,
    current: {
      meta: kpi(bundle.metaCurrent.account),
      google: kpi(bundle.current.account),
    },
    previous: {
      meta: kpi(bundle.metaPrevious.account),
      google: kpi(bundle.previous.account),
    },
    daily,
    campaigns,
  });
}
