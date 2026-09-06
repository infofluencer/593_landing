import { headers } from "next/headers";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelTable } from "@/components/panel/ui";
import { requireBundle, resolvePanelTenant } from "@/lib/panel/data";
import { fetchMerchantProductIssues } from "@/lib/integrations/google/merchant";
import { useMockPanelData } from "@/lib/integrations/tokens";

const MOCK_ISSUES = [
  {
    offerId: "SKU-1001",
    title: "İpek Şal — Bordo",
    severity: "critical",
    detail: "Fiyat uyuşmazlığı (landing vs feed)",
  },
  {
    offerId: "SKU-2044",
    title: "Kaşmir Eşarp",
    severity: "warning",
    detail: "Stok alanı eksik",
  },
];

export default async function MerchantPage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const tenant = await resolvePanelTenant(slug);
  const merchantId = tenant?.mapping.merchantId;

  if (bundle.tenant.type !== "ecommerce" || !merchantId) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Merchant Center
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
          {bundle.tenant.type !== "ecommerce"
            ? "Lead markalarında Merchant modülü gösterilmez."
            : "Bu marka için merchantId yok — modül pasif."}{" "}
          ({bundle.tenant.name})
        </div>
      </div>
    );
  }

  type Issue = (typeof MOCK_ISSUES)[number];
  let issues: Issue[] = [];
  let liveError: string | null = null;
  let mode: "mock" | "live" | "empty" = "empty";

  if (useMockPanelData()) {
    issues = MOCK_ISSUES;
    mode = "mock";
  } else {
    try {
      issues = await fetchMerchantProductIssues({ merchantId });
      mode = "live";
    } catch (err) {
      liveError = err instanceof Error ? err.message : String(err);
      issues = [];
      mode = "empty";
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Merchant Center
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ürün durumları · reddedilen / veri sorunları
          </p>
        </div>
        <StatusBadge
          status={liveError ? "unknown" : "ok"}
          label={
            liveError
              ? "Kontrol edilemedi"
              : mode === "mock"
                ? "Mock"
                : "Canlı"
          }
        />
      </div>

      {liveError ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Merchant API: {liveError} — ürün listesi boş (sıfır / mock
          uydurulmadı).
        </div>
      ) : null}

      {issues.length === 0 && !liveError ? (
        <p className="text-sm text-zinc-500">Açık ürün sorunu yok.</p>
      ) : null}

      {issues.length > 0 ? (
        <PanelTable headers={["Ürün", "Offer ID", "Önem", "Sorun"]}>
          {issues.map((i) => (
            <tr key={`${i.offerId}-${i.detail}`} className="text-zinc-700">
              <td className="px-3 py-2.5 font-medium text-zinc-900">
                {i.title}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                {i.offerId}
              </td>
              <td className="px-3 py-2.5 text-xs capitalize">{i.severity}</td>
              <td className="px-3 py-2.5 text-sm">{i.detail}</td>
            </tr>
          ))}
        </PanelTable>
      ) : null}
    </div>
  );
}
