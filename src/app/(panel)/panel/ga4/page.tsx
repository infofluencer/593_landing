import { Suspense } from "react";
import { headers } from "next/headers";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import {
  CompareTrendChart,
  DonutChart,
  LabeledBarChart,
  StatTile,
  type ComparePoint,
} from "@/components/panel/ds/viz";
import { deltaPct } from "@/components/panel/ds/chart-theme";
import { requireBundle } from "@/lib/panel/data";
import { resolveGa4PropertyId } from "@/lib/panel/ga4-property-map";
import { isIntegrationDisabled } from "@/lib/panel/integrations";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { loadTenantStatus } from "@/lib/panel/tenant-status";
import {
  fetchGa4Snapshot,
  type Ga4KeyEventRow,
} from "@/lib/integrations/google/ga4";
import { useMockPanelData } from "@/lib/integrations/tokens";
import { formatNumber, formatTry } from "@/lib/panel/format";
import type {
  MockGa4DailyPoint,
  MockGa4Overview,
  MockGa4Row,
} from "@/lib/panel/mock-data";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function dayLabel(ymd: string): string {
  return `${Number(ymd.slice(8, 10))} ${TR_MONTHS[Number(ymd.slice(5, 7)) - 1]}`;
}

/** Bu dönem günlükleri önceki dönemle aynı sırada eşler. */
function compare(
  cur: MockGa4DailyPoint[],
  prev: MockGa4DailyPoint[],
  key: keyof Omit<MockGa4DailyPoint, "date">,
): ComparePoint[] {
  return cur.map((p, i) => ({
    label: dayLabel(p.date),
    current: Number(p[key] ?? 0),
    previous: prev[i] ? Number(prev[i]![key] ?? 0) : null,
  }));
}

function series(points: MockGa4DailyPoint[], key: keyof Omit<MockGa4DailyPoint, "date">): number[] {
  return points.map((p) => Number(p[key] ?? 0));
}

function pctDelta(cur: number, prev: MockGa4Overview | null | undefined, key: keyof MockGa4Overview) {
  if (!prev) return null;
  const p = prev[key];
  return typeof p === "number" ? deltaPct(cur, p) : null;
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
  const { tenant, syncJobs } = bundle;
  const ecommerce = tenant.type === "ecommerce";
  const ga4Job = syncJobs.find((j) => j.service === "ga4");
  const ga4Property =
    resolveGa4PropertyId(tenant) || tenant.mapping.ga4PropertyId;
  const status = await loadTenantStatus(bundle, null);

  let ga4: MockGa4Overview = bundle.ga4;
  let ga4Channels: MockGa4Row[] = bundle.ga4Channels;
  let ga4Landings: MockGa4Row[] = bundle.ga4Landings;
  let keyEventsByName: Ga4KeyEventRow[] = [];
  let liveError: string | null = null;
  let mode: "mock" | "live" | "db" | "empty" = useMockPanelData()
    ? "mock"
    : "empty";

  if (!useMockPanelData() && ga4Property && !isIntegrationDisabled(tenant, "ga4")) {
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
      keyEventsByName = snap.keyEventsByName;
      mode = "live";
    } catch (err) {
      liveError = err instanceof Error ? err.message : String(err);
      const hasDb =
        bundle.ga4.sessions > 0 || bundle.ga4Channels.length > 0;
      if (hasDb) {
        mode = "db";
      } else {
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
  const daily = bundle.ga4Daily ?? [];
  const prevDaily = bundle.ga4PrevDaily ?? [];
  const prev = bundle.ga4Previous ?? null;
  const badgeStatus = unknown
    ? "unknown"
    : liveError || ga4Job?.status === "error"
      ? "warn"
      : status.ga4.status === "unknown"
        ? "ok"
        : status.ga4.status;
  const reasons = [
    ...status.ga4.reasons.map((r) => r.text),
    ...(liveError && mode === "db"
      ? ["Canlı GA4 verisi alınamadı — son senkron verisi gösteriliyor"]
      : []),
  ];
  const convRate = ga4.sessionConversionRate * 100;
  const bounce = ga4.bounceRate * 100;

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
            Kullanıcı · oturum · kanal · açılış sayfası · {range.label} ·
            önceki dönemle karşılaştırma
          </p>
        </div>
        <StatusBadge status={badgeStatus} reasons={reasons} />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      {unknown ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          GA4 verisi şu an alınamıyor. Metrikler 0 olarak yazılmadı — durum:
          Kontrol edilemedi.
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <CompareTrendChart
                title="Web trafik kullanıcı trendi"
                data={compare(daily, prevDaily, "users")}
                total={ga4.totalUsers}
                delta={pctDelta(ga4.totalUsers, prev, "totalUsers")}
                variant="navy"
              />
            </div>
            <div className="lg:col-span-2">
              <DonutChart
                title="Kullanıcı kanalları"
                data={ga4Channels.map((c) => ({ name: c.dimension, value: c.sessions }))}
                centerLabel="Oturum"
                variant="dark"
                delta={pctDelta(ga4.sessions, prev, "sessions")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              label="Kullanıcı sayısı"
              value={formatNumber(ga4.totalUsers)}
              delta={pctDelta(ga4.totalUsers, prev, "totalUsers")}
              values={series(daily, "users")}
            />
            <StatTile
              label="Oturum"
              value={formatNumber(ga4.sessions)}
              delta={pctDelta(ga4.sessions, prev, "sessions")}
              values={series(daily, "sessions")}
            />
            <StatTile
              label="Kullanıcı başına oturum süresi"
              value={formatDuration(ga4.averageSessionDuration)}
              delta={pctDelta(ga4.averageSessionDuration, prev, "averageSessionDuration")}
              values={series(daily, "avgDuration")}
            />
            <StatTile
              label="Kullanıcı dönüşüm oranı"
              value={`${formatNumber(convRate, 2)}%`}
              delta={pctDelta(ga4.sessionConversionRate, prev, "sessionConversionRate")}
              values={series(daily, "conversionRate").map((v) => v * 100)}
            />
            <StatTile
              label="Çıkma oranı"
              value={`${formatNumber(bounce, 1)}%`}
              delta={pctDelta(ga4.bounceRate, prev, "bounceRate")}
              invert
              values={series(daily, "bounceRate").map((v) => v * 100)}
            />
            <StatTile
              label="Oturum başına sayfa"
              value={formatNumber(ga4.screenPageViewsPerSession, 1)}
              delta={pctDelta(ga4.screenPageViewsPerSession, prev, "screenPageViewsPerSession")}
              values={series(daily, "pagesPerSession")}
            />
            {ecommerce && ga4.purchaseRevenue != null ? (
              <StatTile
                label="Satın alma geliri"
                value={formatTry(ga4.purchaseRevenue, tenant.currency)}
                delta={
                  prev?.purchaseRevenue != null
                    ? deltaPct(ga4.purchaseRevenue, prev.purchaseRevenue)
                    : null
                }
                values={daily.map((p) => p.revenue ?? 0)}
                variant="navy"
              />
            ) : null}
            {ecommerce && ga4.transactions != null ? (
              <StatTile
                label="Sipariş sayısı"
                value={formatNumber(ga4.transactions)}
                delta={
                  prev?.transactions != null
                    ? deltaPct(ga4.transactions, prev.transactions)
                    : null
                }
                values={daily.map((p) => p.transactions ?? 0)}
              />
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <LabeledBarChart
              title="Kanallara göre anahtar etkinlik"
              data={ga4Channels.map((c) => ({ name: c.dimension, value: Math.round(c.conversions) }))}
              layout="horizontal"
              variant="dark"
              color="#15803D"
              max={8}
            />
            <LabeledBarChart
              title="En çok ziyaret edilen açılış sayfaları"
              data={ga4Landings.map((r) => ({ name: r.dimension, value: r.sessions }))}
              layout="horizontal"
              variant="navy"
              color="#8fb3ff"
              max={8}
            />
          </div>

          {keyEventsByName.length > 0 ? (
            <LabeledBarChart
              title="Anahtar etkinlikler (GA4 dönüşümleri)"
              data={keyEventsByName.map((r) => ({ name: r.eventName, value: Math.round(r.keyEvents) }))}
              layout="horizontal"
              variant="light"
              color="#15803D"
              max={10}
            />
          ) : null}

          {mode === "db" ? (
            <p className="text-xs text-zinc-500">
              Rakamlar son senkron verisinden toplandı; kullanıcı sayısı günlük
              toplamdır (tekil değil). Açılış sayfaları yalnızca canlı veride
              gösterilir.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
