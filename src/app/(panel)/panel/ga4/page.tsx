import { Suspense } from "react";
import { headers } from "next/headers";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { resolveGa4PropertyId } from "@/lib/panel/ga4-property-map";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { fetchGa4Snapshot } from "@/lib/integrations/google/ga4";
import { useMockPanelData } from "@/lib/integrations/tokens";
import { formatNumber, formatTry } from "@/lib/panel/format";
import type { MockGa4Overview, MockGa4Row } from "@/lib/panel/mock-data";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function Ga4Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const sp = await searchParams;
  const range = await resolvePanelDateRange(sp);
  const bundle = await requireBundle(slug, {
    from: range.startDate,
    to: range.endDate,
  });
  const { tenant, health, syncJobs } = bundle;
  const ecommerce = tenant.type === "ecommerce";
  const ga4Job = syncJobs.find((j) => j.service === "ga4");
  const ga4Property =
    resolveGa4PropertyId(tenant) || tenant.mapping.ga4PropertyId;

  let ga4: MockGa4Overview = bundle.ga4;
  let ga4Channels: MockGa4Row[] = bundle.ga4Channels;
  let ga4Landings: MockGa4Row[] = bundle.ga4Landings;
  let liveError: string | null = null;
  let mode: "mock" | "live" | "db" | "empty" = useMockPanelData()
    ? "mock"
    : "empty";

  if (!useMockPanelData() && ga4Property) {
    try {
      const snap = await fetchGa4Snapshot({
        propertyId: ga4Property,
        from: range.startDate,
        to: range.endDate,
        ecommerce,
      });
      ga4 = {
        totalUsers: snap.overview.totalUsers,
        sessions: snap.overview.sessions,
        averageSessionDuration: snap.overview.averageSessionDuration,
        bounceRate: snap.overview.bounceRate,
        screenPageViewsPerSession: snap.overview.screenPageViewsPerSession,
        sessionConversionRate: snap.overview.sessionConversionRate,
        purchaseRevenue: snap.overview.purchaseRevenue,
        transactions: snap.overview.transactions,
      };
      ga4Channels = snap.channels.map((r) => ({
        dimension: r.dimension,
        sessions: r.sessions,
        users: r.users,
        conversions: r.conversions,
      }));
      ga4Landings = snap.landings.map((r) => ({
        dimension: r.dimension,
        sessions: r.sessions,
        users: r.users,
        conversions: r.conversions,
      }));
      mode = "live";
    } catch (err) {
      liveError = err instanceof Error ? err.message : String(err);
      const hasDb =
        bundle.ga4.sessions > 0 ||
        bundle.ga4Channels.length > 0 ||
        bundle.ga4Landings.length > 0;
      if (hasDb) {
        ga4 = bundle.ga4;
        ga4Channels = bundle.ga4Channels;
        ga4Landings = bundle.ga4Landings;
        mode = "db";
      } else {
        ga4 = {
          totalUsers: 0,
          sessions: 0,
          averageSessionDuration: 0,
          bounceRate: 0,
          screenPageViewsPerSession: 0,
          sessionConversionRate: 0,
          purchaseRevenue: null,
          transactions: null,
        };
        ga4Channels = [];
        ga4Landings = [];
        mode = "empty";
      }
    }
  } else if (!useMockPanelData() && !ga4Property) {
    liveError = "GA4 property eşleşmemiş (map / Ayarlar)";
    mode = "empty";
  } else if (useMockPanelData()) {
    mode = "mock";
  }

  const unknown = mode === "empty";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
            Google Analytics 4
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Site davranışı
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Kullanıcı · oturum · kanal · açılış sayfası
            {ga4Property ? ` · ${ga4Property}` : " · property eşleşmemiş"}
            {" · "}
            {range.label}
          </p>
        </div>
        <StatusBadge
          status={
            unknown
              ? "unknown"
              : liveError || ga4Job?.status === "error"
                ? "warn"
                : health === "unknown"
                  ? "ok"
                  : health
          }
        />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      {liveError ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          {mode === "db" ? (
            <>
              Canlı GA4 çekilemedi — son sync verisi gösteriliyor (seçilen
              dönemle birebir olmayabilir).
              <span className="mt-1 block text-xs text-zinc-500">
                {liveError}
              </span>
            </>
          ) : (
            <>
              GA4 verisi alınamadı.
              <span className="mt-1 block text-xs text-zinc-500">
                {liveError}
              </span>
            </>
          )}
        </div>
      ) : null}

      {unknown && !liveError ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          GA4 verisi alınamadı. Metrikler 0 olarak yazılmadı — durum: Kontrol
          edilemedi.
          {ga4Job?.error ? (
            <span className="mt-1 block text-xs text-zinc-500">
              {ga4Job.error}
            </span>
          ) : null}
        </div>
      ) : null}

      {!unknown ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <PanelStat
              label="Kullanıcı"
              value={formatNumber(ga4.totalUsers)}
            />
            <PanelStat label="Oturum" value={formatNumber(ga4.sessions)} />
            <PanelStat
              label="Ort. oturum süresi"
              value={formatDuration(ga4.averageSessionDuration)}
            />
            <PanelStat
              label="Hemen çıkma"
              value={`${formatNumber(ga4.bounceRate * 100, 1)}%`}
            />
            <PanelStat
              label="Sayfa / oturum"
              value={formatNumber(ga4.screenPageViewsPerSession, 1)}
            />
            <PanelStat
              label="Oturum dönüşüm oranı"
              value={`${formatNumber(ga4.sessionConversionRate * 100, 2)}%`}
            />
            {ecommerce && ga4.purchaseRevenue != null ? (
              <PanelStat
                label="Satın alma geliri"
                value={formatTry(ga4.purchaseRevenue, tenant.currency)}
              />
            ) : null}
            {ecommerce && ga4.transactions != null ? (
              <PanelStat
                label="İşlem"
                value={formatNumber(ga4.transactions)}
              />
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-800">
                Kanallar
              </h3>
              <PanelTable
                headers={["Kanal", "Oturum", "Kullanıcı", "Dönüşüm"]}
              >
                {ga4Channels.map((r) => (
                  <tr key={r.dimension} className="text-zinc-700">
                    <td className="px-3 py-2.5 font-medium text-zinc-900">
                      {r.dimension}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.sessions)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.users)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.conversions)}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-800">
                Açılış sayfaları
              </h3>
              <PanelTable
                headers={["Sayfa", "Oturum", "Kullanıcı", "Dönüşüm"]}
              >
                {ga4Landings.map((r) => (
                  <tr key={r.dimension} className="text-zinc-700">
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-900">
                      {r.dimension}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.sessions)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.users)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.conversions)}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
