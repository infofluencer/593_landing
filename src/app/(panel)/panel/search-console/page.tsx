import { Suspense } from "react";
import { headers } from "next/headers";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { GscQueryBarChart, GscTrendChart } from "@/components/panel/charts";
import { PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle, resolvePanelTenant } from "@/lib/panel/data";
import { formatNumber } from "@/lib/panel/format";
import { resolvePanelDateRange } from "@/lib/panel/period";
import {
  fetchSearchConsoleQuery,
  type GscRow,
} from "@/lib/integrations/google/gsc";
import { useMockPanelData } from "@/lib/integrations/tokens";

const MOCK_QUERIES: GscRow[] = [
  { keys: ["şal"], clicks: 420, impressions: 8900, ctr: 0.047, position: 8.2 },
  { keys: ["eşarp"], clicks: 310, impressions: 7200, ctr: 0.043, position: 9.1 },
  {
    keys: ["ipek şal"],
    clicks: 180,
    impressions: 4100,
    ctr: 0.044,
    position: 6.4,
  },
  { keys: ["mareen"], clicks: 150, impressions: 2200, ctr: 0.068, position: 4.1 },
  {
    keys: ["omuz şalı"],
    clicks: 95,
    impressions: 3100,
    ctr: 0.031,
    position: 7.8,
  },
];

function mockDailyForRange(fromYmd: string, toYmd: string): GscRow[] {
  const rows: GscRow[] = [];
  const start = new Date(`${fromYmd}T12:00:00Z`);
  const end = new Date(`${toYmd}T12:00:00Z`);
  let i = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const ymd = d.toISOString().slice(0, 10);
    rows.push({
      keys: [ymd],
      clicks: 40 + ((i * 17) % 55),
      impressions: 900 + ((i * 83) % 400),
      ctr: 0.04,
      position: 6.5,
    });
    i++;
  }
  return rows;
}

function shortQuery(q: string, max = 18): string {
  return q.length > max ? `${q.slice(0, max - 1)}…` : q;
}

function formatDayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[3])}.${Number(m[2])}`;
}

function weightedAvg(
  rows: GscRow[],
  pick: (r: GscRow) => number,
  weight: (r: GscRow) => number,
): number | null {
  let wSum = 0;
  let vSum = 0;
  for (const r of rows) {
    const w = weight(r);
    if (w <= 0) continue;
    wSum += w;
    vSum += pick(r) * w;
  }
  return wSum > 0 ? vSum / wSum : null;
}

export default async function SearchConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const sp = await searchParams;
  const range = await resolvePanelDateRange(sp);
  await requireBundle(slug);
  const tenant = await resolvePanelTenant(slug);
  const siteUrl = tenant?.mapping.gscSiteUrl;

  let queryRows: GscRow[] = [];
  let dailyRows: GscRow[] = [];
  let liveError: string | null = null;
  let mode: "mock" | "live" | "empty" = "empty";

  const fromYmd = range.startDate;
  const toYmd = range.endDate;

  if (!siteUrl) {
    mode = "empty";
  } else if (useMockPanelData()) {
    queryRows = MOCK_QUERIES;
    dailyRows = mockDailyForRange(fromYmd, toYmd);
    mode = "mock";
  } else {
    try {
      const [queries, daily] = await Promise.all([
        fetchSearchConsoleQuery({
          siteUrl,
          from: fromYmd,
          to: toYmd,
          dimensions: ["query"],
          rowLimit: 40,
        }),
        fetchSearchConsoleQuery({
          siteUrl,
          from: fromYmd,
          to: toYmd,
          dimensions: ["date"],
          rowLimit: 500,
        }),
      ]);
      queryRows = queries;
      dailyRows = daily.sort((a, b) =>
        (a.keys[0] ?? "").localeCompare(b.keys[0] ?? ""),
      );
      mode = "live";
    } catch (err) {
      liveError = err instanceof Error ? err.message : String(err);
      queryRows = [];
      dailyRows = [];
      mode = "empty";
    }
  }

  const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0);
  const totalImpr = queryRows.reduce((s, r) => s + r.impressions, 0);
  const periodClicks = dailyRows.length
    ? dailyRows.reduce((s, r) => s + r.clicks, 0)
    : totalClicks;
  const periodImpr = dailyRows.length
    ? dailyRows.reduce((s, r) => s + r.impressions, 0)
    : totalImpr;
  const avgCtr =
    periodImpr > 0
      ? periodClicks / periodImpr
      : (weightedAvg(queryRows, (r) => r.ctr, (r) => r.impressions) ?? 0);
  const avgPos =
    weightedAvg(queryRows, (r) => r.position, (r) => r.impressions) ?? 0;

  const trendData = dailyRows.map((r) => ({
    label: formatDayLabel(r.keys[0] ?? ""),
    clicks: r.clicks,
    impressions: r.impressions,
  }));

  const topQueries = [...queryRows]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
    .map((r) => ({
      name: shortQuery(r.keys[0] ?? "(boş)"),
      clicks: r.clicks,
      impressions: r.impressions,
    }));

  const hasData = queryRows.length > 0 || dailyRows.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Search Console
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Organik tıklama · gösterim · CTR · ortalama konum · sorgular
          </p>
        </div>
        <StatusBadge
          status={liveError || !siteUrl ? "unknown" : "ok"}
          label={
            liveError
              ? "Kontrol edilemedi"
              : !siteUrl
                ? "Site URL eksik"
                : mode === "mock"
                  ? "Mock"
                  : "Canlı"
          }
        />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      {!siteUrl ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          TenantMapping.gscSiteUrl eşleştirilmemiş.
        </div>
      ) : null}

      {liveError ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          GSC API: {liveError} — sonuç listesi boş bırakıldı (sıfır / mock
          uydurulmadı).
        </div>
      ) : null}

      {!hasData && !liveError && siteUrl && mode !== "mock" ? (
        <p className="text-sm text-zinc-500">Bu dönem için sorgu yok.</p>
      ) : null}

      {hasData ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PanelStat
              label="Tıklama"
              value={formatNumber(periodClicks)}
              hint={
                <span className="text-[11px] text-zinc-500">
                  {queryRows.length} sorgu satırı
                </span>
              }
            />
            <PanelStat label="Gösterim" value={formatNumber(periodImpr)} />
            <PanelStat
              label="Ort. CTR"
              value={`${formatNumber(avgCtr * 100, 2)}%`}
            />
            <PanelStat
              label="Ort. konum"
              value={formatNumber(avgPos, 1)}
              hint={
                <span className="text-[11px] text-zinc-500">
                  Gösterim ağırlıklı
                </span>
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Günlük tıklama · gösterim
              </p>
              <GscTrendChart data={trendData} />
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                En çok tıklanan sorgular
              </p>
              <GscQueryBarChart data={topQueries} />
            </div>
          </div>

          {queryRows.length > 0 ? (
            <PanelTable
              headers={["Sorgu", "Tıklama", "Gösterim", "CTR", "Konum"]}
            >
              {queryRows.map((r) => (
                <tr key={r.keys.join("|")} className="text-zinc-700">
                  <td className="px-3 py-2.5 font-medium text-zinc-900">
                    {r.keys[0]}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(r.clicks)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(r.impressions)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(r.ctr * 100, 2)}%
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(r.position, 1)}
                  </td>
                </tr>
              ))}
            </PanelTable>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
