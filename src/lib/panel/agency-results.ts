import type { TenantType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDaysYmd, ymdToUtcDate } from "@/lib/date/tr";
import { endOfMonthYmd, shiftBudgetMonth } from "@/lib/panel/brand-budget";
import { metaConv } from "@/lib/panel/data";

/** Ajans geneli sonuçlar — panel KPI'larıyla aynı dönüşüm kuralı (metaConv + Ads conversions). */
export type AgencyResults = {
  month: string;
  /** Ay başından bugüne gün gün: lead markaların lead'i, e-ticaret markaların satışı. */
  days: Array<{ date: string; lead: number; sale: number }>;
  current: ResultTotals;
  /** Geçen ayın aynı gün aralığı (1..bugünkü gün). */
  previous: ResultTotals;
  /** Son 7 kapanmış gün vs önceki 7 gün — maliyeti en çok kötüleşenler. */
  worsening: Array<{
    slug: string;
    name: string;
    type: TenantType;
    currency: string;
    spend7: number;
    conv7: number;
    cpa7: number | null;
    cpaPrev: number | null;
    /** Yüzde değişim; dönüşüm 0'a düştüyse null. */
    changePct: number | null;
  }>;
};

type ResultTotals = {
  lead: number;
  sale: number;
  leadSpend: number;
  saleSpend: number;
  saleValue: number;
};

const emptyTotals = (): ResultTotals => ({
  lead: 0,
  sale: 0,
  leadSpend: 0,
  saleSpend: 0,
  saleValue: 0,
});

/** Gürültü olmasın: önceki dönemde en az bu kadar dönüşüm olmalı. */
const MIN_PREV_CONV = 3;

export async function loadAgencyResults(opts: {
  tenants: Array<{ slug: string }>;
  today: string;
  month: string;
}): Promise<AgencyResults> {
  const { today, month } = opts;
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: opts.tenants.map((t) => t.slug) } },
    select: { id: true, slug: true, name: true, type: true, currency: true },
  });
  const ids = tenants.map((t) => t.id);
  const byId = new Map(tenants.map((t) => [t.id, t]));

  const prevMonth = shiftBudgetMonth(month, -1);
  const day = Number(today.slice(8, 10));
  const prevEndDay = Math.min(day, Number(endOfMonthYmd(prevMonth).slice(8, 10)));
  const prevTo = `${prevMonth}-${String(prevEndDay).padStart(2, "0")}`;
  const win7From = addDaysYmd(today, -7);
  const win14From = addDaysYmd(today, -14);
  const from = [`${prevMonth}-01`, win14From].sort()[0];

  const [metaRows, googleRows] = ids.length
    ? await Promise.all([
        prisma.metaInsight.findMany({
          where: { tenantId: { in: ids }, date: { gte: ymdToUtcDate(from), lte: ymdToUtcDate(today) } },
          select: {
            tenantId: true,
            date: true,
            spend: true,
            actions: true,
            actionValues: true,
            conversions: true,
            convValue: true,
          },
        }),
        prisma.googleAdsMetric.groupBy({
          by: ["tenantId", "date"],
          where: { tenantId: { in: ids }, date: { gte: ymdToUtcDate(from), lte: ymdToUtcDate(today) } },
          _sum: { cost: true, conversions: true, convValue: true },
        }),
      ])
    : [[], []];

  // tenantId|date → spend, conv, value
  const cells = new Map<string, { spend: number; conv: number; value: number }>();
  const add = (tenantId: string, date: string, spend: number, conv: number, value: number) => {
    const key = `${tenantId}|${date}`;
    const c = cells.get(key) ?? { spend: 0, conv: 0, value: 0 };
    c.spend += spend;
    c.conv += conv;
    c.value += value;
    cells.set(key, c);
  };
  for (const m of metaRows) {
    const t = byId.get(m.tenantId);
    if (!t) continue;
    const k = metaConv(t.type, m);
    add(m.tenantId, m.date.toISOString().slice(0, 10), Number(m.spend), k.conv, k.convValue);
  }
  for (const g of googleRows) {
    add(
      g.tenantId,
      g.date.toISOString().slice(0, 10),
      Number(g._sum.cost ?? 0),
      Number(g._sum.conversions ?? 0),
      Number(g._sum.convValue ?? 0),
    );
  }

  const days: AgencyResults["days"] = [];
  for (let d = 1; d <= day; d++) {
    days.push({ date: `${month}-${String(d).padStart(2, "0")}`, lead: 0, sale: 0 });
  }
  const dayIdx = new Map(days.map((d, i) => [d.date, i]));
  const current = emptyTotals();
  const previous = emptyTotals();
  const perTenant = new Map<string, { s7: number; c7: number; sp: number; cp: number }>();

  for (const [key, c] of cells) {
    const [tenantId, date] = key.split("|");
    const t = byId.get(tenantId)!;
    const lead = t.type === "lead";
    const bucket =
      date.startsWith(month) ? current : date >= `${prevMonth}-01` && date <= prevTo ? previous : null;
    if (bucket) {
      if (lead) {
        bucket.lead += c.conv;
        bucket.leadSpend += c.spend;
      } else {
        bucket.sale += c.conv;
        bucket.saleSpend += c.spend;
        bucket.saleValue += c.value;
      }
    }
    const i = dayIdx.get(date);
    if (i != null) {
      if (lead) days[i].lead += c.conv;
      else days[i].sale += c.conv;
    }
    // Bugün hariç: son 7 kapanmış gün / önceki 7 gün.
    if (date < today && date >= win14From) {
      const p = perTenant.get(tenantId) ?? { s7: 0, c7: 0, sp: 0, cp: 0 };
      if (date >= win7From) {
        p.s7 += c.spend;
        p.c7 += c.conv;
      } else {
        p.sp += c.spend;
        p.cp += c.conv;
      }
      perTenant.set(tenantId, p);
    }
  }

  const worsening: AgencyResults["worsening"] = [];
  for (const [tenantId, p] of perTenant) {
    const t = byId.get(tenantId)!;
    if (p.s7 <= 0 || p.cp < MIN_PREV_CONV) continue;
    const cpa7 = p.c7 > 0 ? p.s7 / p.c7 : null;
    const cpaPrev = p.sp / p.cp;
    const changePct = cpa7 != null ? Math.round((cpa7 / cpaPrev - 1) * 100) : null;
    if (changePct != null && changePct <= 0) continue;
    worsening.push({
      slug: t.slug,
      name: t.name,
      type: t.type,
      currency: t.currency,
      spend7: p.s7,
      conv7: p.c7,
      cpa7,
      cpaPrev,
      changePct,
    });
  }
  // Dönüşümü sıfıra düşenler en üstte, sonra en çok kötüleşen.
  worsening.sort((a, b) =>
    a.changePct == null && b.changePct == null
      ? b.spend7 - a.spend7
      : a.changePct == null
        ? -1
        : b.changePct == null
          ? 1
          : b.changePct - a.changePct,
  );

  return {
    month,
    days: days.map((d) => ({
      ...d,
      lead: Math.round(d.lead * 10) / 10,
      sale: Math.round(d.sale * 10) / 10,
    })),
    current,
    previous,
    worsening: worsening.slice(0, 5),
  };
}
