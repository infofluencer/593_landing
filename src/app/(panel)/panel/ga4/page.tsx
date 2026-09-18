import { Suspense } from "react";
import { headers } from "next/headers";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { KPICard, DataTable } from "@/components/panel/ds";
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

function sumGa4Rows(rows: MockGa4Row[]) {
  return rows.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      users: acc.users + r.users,
      conversions: acc.conversions + r.conversions,
    }),
    { sessions: 0, users: 0, conversions: 0 },
  );
}

function Ga4DimTable({
  title,
  dimHeader,
  rows,
}: {
  title: string;
  dimHeader: string;
  rows: MockGa4Row[];
}) {
  const totals = sumGa4Rows(rows);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      <DataTable
        headers={[
          dimHeader,
          { key: "sessions", label: "Oturum", metricKey: "sessions" },
          { key: "users", label: "Kullanıcı", metricKey: "users" },
          {
            key: "conversions",
            label: "Dönüşüm",
            metricKey: "conversions",
          },
        ]}
        numericCols={[1, 2, 3]}
      >
        {rows.length > 0 ? (
          <tr data-total>
            <td>Toplam</td>
            <td className="num">{formatNumber(totals.sessions)}</td>
            <td className="num">{formatNumber(totals.users)}</td>
            <td className="num">{formatNumber(totals.conversions)}</td>
          </tr>
        ) : null}
        {rows.map((r) => (
          <tr key={r.dimension}>
            <td
              className={
                dimHeader === "Sayfa"
                  ? "font-mono text-xs text-panel-fg"
                  : "font-medium text-panel-fg"
              }
            >
              {r.dimension}
            </td>
            <td className="num">{formatNumber(r.sessions)}</td>
            <td className="num">{formatNumber(r.users)}</td>
            <td className="num">{formatNumber(r.conversions)}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
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

      {/* Tier 1 — kuzey yıldızı */}
      <div
        className={`grid gap-4 sm:grid-cols-2 ${
          ecommerce ? "xl:grid-cols-4" : "xl:grid-cols-3"
        }`}
      >
        <KPICard
          tier={1}
          metricKey="users"
          kind="count"
          accent="var(--panel-google-green)"
          value={unknown ? null : formatNumber(ga4.totalUsers)}
          goodDirection="up"
        />
        <KPICard
          tier={1}
          metricKey="sessions"
          kind="count"
          accent="var(--panel-google-green)"
          value={unknown ? null : formatNumber(ga4.sessions)}
          goodDirection="up"
        />
        <KPICard
          tier={1}
          metricKey="sessionConvRate"
          kind="rate"
          accent="var(--panel-google-green)"
          value={
            unknown
              ? null
              : `${formatNumber(ga4.sessionConversionRate * 100, 2)}%`
          }
          goodDirection="up"
        />
        {ecommerce ? (
          <KPICard
            tier={1}
            metricKey="revenue"
            kind="money"
            label="Satın alma geliri"
            accent="var(--panel-google-green)"
            value={
              unknown || ga4.purchaseRevenue == null
                ? null
                : formatTry(ga4.purchaseRevenue, tenant.currency)
            }
            goodDirection="up"
          />
        ) : null}
      </div>

      {!unknown ? (
        <>
          {/* Tier 2 — destekleyici */}
          <div
            className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
              ecommerce && ga4.transactions != null ? "xl:grid-cols-4" : ""
            }`}
          >
            <KPICard
              tier={2}
              metricKey="avgSessionDuration"
              kind="duration"
              value={formatDuration(ga4.averageSessionDuration)}
              goodDirection="up"
            />
            <KPICard
              tier={2}
              metricKey="bounceRate"
              kind="rate"
              value={`${formatNumber(ga4.bounceRate * 100, 1)}%`}
              goodDirection="down"
            />
            <KPICard
              tier={2}
              metricKey="pagePerSession"
              kind="count"
              value={formatNumber(ga4.screenPageViewsPerSession, 1)}
              goodDirection="up"
            />
            {ecommerce && ga4.transactions != null ? (
              <KPICard
                tier={2}
                metricKey="transactions"
                kind="count"
                value={formatNumber(ga4.transactions)}
                goodDirection="up"
              />
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Ga4DimTable
              title="Kanallar"
              dimHeader="Kanal"
              rows={ga4Channels}
            />
            <Ga4DimTable
              title="Açılış sayfaları"
              dimHeader="Sayfa"
              rows={ga4Landings}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
