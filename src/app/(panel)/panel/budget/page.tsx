import { headers } from "next/headers";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelStat } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import {
  estimateMonthEndSpend,
  mockToday,
} from "@/lib/panel/mock-data";
import { formatNumber, formatTry } from "@/lib/panel/format";

export default async function BudgetPage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const { tenant, periodSpend, health, current, metaCurrent, thresholds } =
    bundle;
  const googleSpend = current.account.spend;
  const metaSpend = metaCurrent.account.spend;

  const today = mockToday();
  const day = today.getDate();
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();

  const target = tenant.monthlyBudget;
  const spent = health === "unknown" ? null : periodSpend;
  const remaining =
    spent === null ? null : Math.max(0, target - spent);
  const projected =
    spent === null ? null : estimateMonthEndSpend(spent, day, daysInMonth);
  const pacePct = spent === null ? null : (spent / target) * 100;
  const expectedPct = (day / daysInMonth) * 100;
  const warnAt = thresholds.budgetPaceWarnPct;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Bütçe ve yayın temposu
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Aylık hedef · gerçekleşen · kalan · tahmini ay sonu
          </p>
        </div>
        <StatusBadge status={health} />
      </div>

      {health === "unknown" || spent === null ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Harcama verisi alınamadı. Kalan / tahmin hesaplanmadı — durum:{" "}
          <strong>Kontrol edilemedi</strong> (sıfır yazılmadı).
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PanelStat
              label="Aylık hedef"
              value={formatTry(target, tenant.currency)}
            />
            <PanelStat
              label="Gerçekleşen"
              value={formatTry(spent, tenant.currency)}
              hint={
                <span className="text-[11px] text-zinc-500">
                  Ayın {day}/{daysInMonth} · tempo {formatNumber(pacePct!, 0)}%
                  (beklenen ~{formatNumber(expectedPct, 0)}%)
                </span>
              }
            />
            <PanelStat
              label="Kalan hedef"
              value={formatTry(remaining!, tenant.currency)}
            />
            <PanelStat
              label="Tahmini ay sonu"
              value={formatTry(projected!, tenant.currency)}
              hint={
                projected! > target * 1.1 ? (
                  <span className="text-[11px] text-amber-700">
                    Hedef aşımı riski
                  </span>
                ) : projected! < target * 0.7 ? (
                  <span className="text-[11px] text-amber-700">
                    Düşük tempo / yayın durması?
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-600">
                    Tempo makul
                  </span>
                )
              }
            />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex justify-between text-xs text-zinc-500">
              <span>Hedefe göre gerçekleşen</span>
              <span className="tabular-nums">
                {formatNumber(pacePct!, 1)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${
                  pacePct! > expectedPct + 15
                    ? "bg-amber-400"
                    : pacePct! < expectedPct - 20
                      ? "bg-rose-400"
                      : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(100, pacePct!)}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PanelStat
              label="Google Ads harcama"
              value={formatTry(googleSpend, tenant.currency)}
            />
            <PanelStat
              label="Meta Ads harcama"
              value={formatTry(metaSpend, tenant.currency)}
            />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs leading-5 text-zinc-400">
            Uyarı eşikleri: tempo ≥ %{warnAt} · dönüşüm kesintisi{" "}
            {thresholds.convDropoutDays} gün · min harcama{" "}
            {formatTry(thresholds.minSpendForAlert, tenant.currency)} (ayarlar
            sayfasından değiştirilir)
          </div>
        </>
      )}
    </div>
  );
}
