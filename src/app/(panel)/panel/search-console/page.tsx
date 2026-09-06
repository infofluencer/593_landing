import { headers } from "next/headers";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelTable } from "@/components/panel/ui";
import { requireBundle, resolvePanelTenant } from "@/lib/panel/data";
import { formatNumber } from "@/lib/panel/format";
import { fetchSearchConsoleQuery } from "@/lib/integrations/google/gsc";
import { useMockPanelData } from "@/lib/integrations/tokens";

const MOCK_QUERIES = [
  { keys: ["şal"], clicks: 420, impressions: 8900, ctr: 0.047, position: 8.2 },
  { keys: ["eşarp"], clicks: 310, impressions: 7200, ctr: 0.043, position: 9.1 },
  {
    keys: ["ipek şal"],
    clicks: 180,
    impressions: 4100,
    ctr: 0.044,
    position: 6.4,
  },
];

export default async function SearchConsolePage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  await requireBundle(slug);
  const tenant = await resolvePanelTenant(slug);
  const siteUrl = tenant?.mapping.gscSiteUrl;

  type Row = (typeof MOCK_QUERIES)[number];
  let rows: Row[] = [];
  let liveError: string | null = null;
  let mode: "mock" | "live" | "empty" = "empty";

  if (!siteUrl) {
    mode = "empty";
  } else if (useMockPanelData()) {
    rows = MOCK_QUERIES;
    mode = "mock";
  } else {
    try {
      const from = new Date();
      from.setDate(from.getDate() - 28);
      rows = await fetchSearchConsoleQuery({
        siteUrl,
        from: from.toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
        dimensions: ["query"],
      });
      mode = "live";
    } catch (err) {
      liveError = err instanceof Error ? err.message : String(err);
      rows = [];
      mode = "empty";
    }
  }

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

      {rows.length === 0 && !liveError && siteUrl && mode !== "mock" ? (
        <p className="text-sm text-zinc-500">Bu dönem için sorgu yok.</p>
      ) : null}

      {rows.length > 0 ? (
        <PanelTable headers={["Sorgu", "Tıklama", "Gösterim", "CTR", "Konum"]}>
          {rows.map((r) => (
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
    </div>
  );
}
