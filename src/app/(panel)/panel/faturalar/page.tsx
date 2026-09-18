import { headers } from "next/headers";
import { Suspense } from "react";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { KPICard } from "@/components/panel/ds";
import { PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import {
  getBillingSyncHints,
  getTenantBillingCharges,
} from "@/lib/panel/billing";
import { formatDateTime, formatNumber } from "@/lib/panel/format";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { prisma } from "@/lib/db";

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency || "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function providerLabel(provider: "meta" | "google"): string {
  return provider === "meta" ? "Meta" : "Google Ads";
}

export default async function FaturalarPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    start?: string;
    end?: string;
    channel?: string;
  }>;
}) {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const sp = await searchParams;
  const range = await resolvePanelDateRange(sp);
  const channel =
    sp.channel === "meta" || sp.channel === "google" ? sp.channel : "all";

  const bundle = await requireBundle(slug, {
    from: range.startDate,
    to: range.endDate,
  });

  const dbTenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });

  const charges = dbTenant
    ? await getTenantBillingCharges(dbTenant.id, {
        from: range.startDate,
        to: range.endDate,
        provider: channel === "all" ? undefined : channel,
      })
    : [];

  const hints = dbTenant
    ? await getBillingSyncHints(dbTenant.id)
    : {
        metaError: null,
        googleError: null,
        metaOkAt: null,
        googleOkAt: null,
      };

  const metaRows = charges.filter((c) => c.provider === "meta");
  const googleRows = charges.filter((c) => c.provider === "google");
  const metaTotal = metaRows.reduce((s, r) => s + r.amount, 0);
  const googleTotal = googleRows.reduce((s, r) => s + r.amount, 0);
  const allTotal = charges.reduce((s, r) => s + r.amount, 0);
  const currency =
    charges[0]?.currency || bundle.tenant.currency || "TRY";

  const channelHref = (next: string) => {
    const q = new URLSearchParams();
    q.set("period", range.period);
    if (range.period === "custom") {
      q.set("start", range.startDate);
      q.set("end", range.endDate);
    }
    if (next !== "all") q.set("channel", next);
    return `/faturalar?${q.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Faturalar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Yalnızca başarılı çekimler — Meta otomatik ödemeler ve Google aylık
            faturalar
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Tümü"],
            ["meta", "Meta"],
            ["google", "Google"],
          ] as const
        ).map(([key, label]) => {
          const active = channel === key;
          return (
            <a
              key={key}
              href={channelHref(key)}
              className={[
                "rounded-md px-3 py-1.5 text-sm transition",
                active
                  ? "bg-zinc-900 font-medium text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50",
              ].join(" ")}
            >
              {label}
            </a>
          );
        })}
      </div>

      {/* Tier 1 — dönem toplamı */}
      <div className="grid gap-4 sm:grid-cols-1">
        <KPICard
          tier={1}
          metricKey="invoiceTotal"
          kind="money"
          label="Toplam başarılı çekim"
          accent="var(--panel-accent)"
          value={formatMoney(allTotal, currency)}
          hint={
            <span className="text-[11px] text-panel-fg-secondary">
              {formatNumber(charges.length, 0)} kayıt · {range.label}
            </span>
          }
          goodDirection="neutral"
        />
      </div>

      {/* Tier 2 — kanal kırılımı */}
      <div className="grid gap-3 sm:grid-cols-2">
        <KPICard
          tier={2}
          metricKey="invoiceTotal"
          kind="money"
          label="Meta"
          value={formatMoney(metaTotal, currency)}
          hint={
            <span className="text-[11px] text-panel-fg-secondary">
              {formatNumber(metaRows.length, 0)} çekim
            </span>
          }
          goodDirection="neutral"
        />
        <KPICard
          tier={2}
          metricKey="invoiceTotal"
          kind="money"
          label="Google Ads"
          value={formatMoney(googleTotal, currency)}
          hint={
            <span className="text-[11px] text-panel-fg-secondary">
              {formatNumber(googleRows.length, 0)} fatura
            </span>
          }
          goodDirection="neutral"
        />
      </div>

      {(hints.metaError || hints.googleError) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {hints.metaError ? (
            <p>
              <span className="font-medium">Meta sync:</span> {hints.metaError}
            </p>
          ) : null}
          {hints.googleError ? (
            <p className={hints.metaError ? "mt-1" : undefined}>
              <span className="font-medium">Google sync:</span>{" "}
              {hints.googleError}
            </p>
          ) : null}
        </div>
      )}

      {channel !== "meta" && googleRows.length === 0 && !hints.googleError ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Google otomatik ödemelerde makbuz API’si yok. Aylık faturalama
          hesaplarında başarılı faturalar burada listelenir. Meta başarılı kart
          çekimleri senkron sonrası görünür.
        </div>
      ) : null}

      {charges.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-6 text-center text-sm text-zinc-600">
          Bu dönemde başarılı çekim kaydı yok. Ajans panelinden Meta / Google
          sync çalıştırın.
        </div>
      ) : (
        <PanelTable
          headers={["Tarih", "Kanal", "Tutar", "Durum", "Belge", "İşlem"]}
        >
          {charges.map((row) => (
            <tr key={row.id} className="text-zinc-700">
              <td className="px-3 py-2.5 whitespace-nowrap text-zinc-900">
                {formatDateTime(row.chargedAt)}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {providerLabel(row.provider)}
              </td>
              <td className="px-3 py-2.5 tabular-nums font-medium text-zinc-900">
                {formatMoney(row.amount, row.currency)}
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  {row.status === "paid" ? "Ödendi" : "Başarılı"}
                </span>
              </td>
              <td className="px-3 py-2.5 max-w-[14rem] truncate text-xs text-zinc-500">
                {row.invoiceNumber || row.externalId}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="flex flex-wrap gap-2">
                  {row.provider === "meta" && row.viewUrl ? (
                    <a
                      href={row.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-[#e91825] hover:underline"
                    >
                      Görüntüle / indir
                    </a>
                  ) : null}
                  {row.provider === "google" ? (
                    <a
                      href={`/api/panel/invoices/${row.id}/download`}
                      className="text-sm font-medium text-[#e91825] hover:underline"
                    >
                      PDF indir
                    </a>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </PanelTable>
      )}

      <p className="text-xs leading-5 text-zinc-400">
        Meta: Billing → Transactions içindeki başarılı kart çekimleri. Google:
        yalnızca aylık faturalama (InvoiceService) — otomatik ödeme makbuzları
        API’de yok.
        {hints.metaOkAt
          ? ` Son Meta sync: ${formatDateTime(hints.metaOkAt)}.`
          : ""}
        {hints.googleOkAt
          ? ` Son Google sync: ${formatDateTime(hints.googleOkAt)}.`
          : ""}
      </p>
    </div>
  );
}
