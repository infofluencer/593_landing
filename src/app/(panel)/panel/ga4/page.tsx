import { headers } from "next/headers";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { formatNumber, formatTry } from "@/lib/panel/format";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function Ga4Page() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const { ga4, ga4Channels, ga4Landings, tenant, health, syncJobs } = bundle;
  const ecommerce = tenant.type === "ecommerce";
  const ga4Job = syncJobs.find((j) => j.service === "ga4");
  const unknown = ga4Job?.status === "error" || health === "unknown";

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
            {tenant.mapping.ga4PropertyId
              ? ` · ${tenant.mapping.ga4PropertyId}`
              : " · property eşleşmemiş"}
          </p>
        </div>
        <StatusBadge status={unknown ? "unknown" : health} />
      </div>

      {unknown ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          GA4 verisi alınamadı. Metrikler 0 olarak yazılmadı — durum: Kontrol
          edilemedi.
        </div>
      ) : (
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
      )}
    </div>
  );
}
