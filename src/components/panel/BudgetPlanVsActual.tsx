import Link from "next/link";
import {
  CumulativeChart,
  PaceStatusBadge,
} from "@/components/panel/BudgetPacingCard";
import BudgetYearTable from "@/components/panel/BudgetYearTable";
import { StatusBadge } from "@/components/panel/ds";
import { DeltaCell } from "@/components/panel/ds/DeltaCell";
import { StatTile } from "@/components/panel/ds/viz";
import { PanelTable } from "@/components/panel/ui";
import {
  budgetPacePct,
  displayCampaignName,
  isManualCampaignId,
  summarizeBudgetPlan,
  type BrandBudgetPlan,
  type BudgetProvider,
} from "@/lib/panel/brand-budget";
import { computeBudgetPacing, dayCount } from "@/lib/panel/budget-pacing";
import { formatTry } from "@/lib/panel/format";

function paceClass(pct: number | null, warnPct: number): string {
  if (pct == null) return "text-panel-fg-muted";
  if (pct >= 100) return "text-panel-critical";
  if (pct >= warnPct) return "text-panel-warn";
  return "text-panel-ok";
}

/**
 * Marka paneli — Planlanan / Harcanan / Kalan. Tahmin ("dönem sonu", "beklenen")
 * yok; "Harcanan" her sayfada aynı rakam (bugün dahil). Düzenleme yok.
 */
export default function BudgetPlanVsActual({
  plan,
  variant = "full",
  provider,
  statusReasons = [],
}: {
  plan: BrandBudgetPlan;
  variant?: "full" | "compact";
  provider?: BudgetProvider;
  /** Durum rozeti sebepleri (ör. "Google Ads 12 gündür harcama yok"). */
  statusReasons?: readonly string[];
}) {
  const campaigns = provider
    ? plan.campaigns.filter((c) => c.provider === provider)
    : plan.campaigns;
  const brandBase = plan.canEdit ? plan.brand : plan.rangeBrand;
  const summary = summarizeBudgetPlan(
    provider
      ? {
          monthlyBudget:
            provider === "google"
              ? brandBase.googleBudget
              : brandBase.metaBudget,
          dailyBudget: null,
        }
      : brandBase,
    campaigns,
  );
  const paceDaily = provider
    ? plan.pace.daily.map((d) => ({
        date: d.date,
        google: provider === "google" ? d.google : 0,
        meta: provider === "meta" ? d.meta : 0,
      }))
    : plan.pace.daily;
  const todayRow = paceDaily.find((d) => d.date === plan.today);
  const todaySpend = todayRow ? todayRow.google + todayRow.meta : 0;
  const pacing = computeBudgetPacing({
    planned: summary.plannedMonthly,
    spent: paceDaily.reduce((sum, d) => sum + d.google + d.meta, 0),
    from: plan.pace.from,
    to: plan.pace.to,
    today: plan.today,
    todaySpend,
  });
  const currency = plan.currency;
  const money = (n: number) => formatTry(n, currency);
  const planned = summary.plannedMonthly;
  const spent = summary.monthSpend;
  const remaining = planned != null ? Math.max(0, planned - spent) : null;
  const totalDays = Math.max(1, dayCount(plan.pace.from, plan.pace.to));
  const dailyAvgPlan = planned != null ? planned / totalDays : null;
  const remainingDays = plan.isCurrentMonth ? pacing.remainingDays : 0;
  const spentPct =
    planned != null && planned > 0
      ? Math.min(100, Math.round((spent / planned) * 100))
      : null;
  const note = plan.canEdit ? plan.brand.note.trim() : "";
  const channelLabel =
    provider === "meta" ? "Meta" : provider === "google" ? "Google Ads" : null;
  const spentHint = plan.isCurrentMonth
    ? `Bugün dahil · bugün ${money(summary.todaySpend)}`
    : plan.rangeLabel;
  const badgeStatus =
    pacing.status === "over" || pacing.status === "done_over"
      ? "critical"
      : pacing.status === "fast" || pacing.status === "slow" || pacing.status === "done_under"
        ? "warn"
        : "ok";
  const spendSeries = [...paceDaily]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((d) => d.date <= plan.today)
    .map((d) => d.google + d.meta);
  const activeCampaigns = campaigns.filter((row) => row.active);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-panel-fg">
            Bütçe{channelLabel ? ` · ${channelLabel}` : ""}
          </h3>
          <PaceStatusBadge status={pacing.status} />
          {statusReasons.length > 0 ? (
            <StatusBadge status={badgeStatus} reasons={statusReasons} />
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-panel-fg-secondary">
          Plan ajans tarafından belirlenir · {plan.rangeLabel}
        </p>
      </div>
      {variant === "compact" ? (
        <Link
          href="/budget"
          className="text-xs font-medium text-panel-accent hover:underline"
        >
          Bütçe detayı →
        </Link>
      ) : null}
    </div>
  );

  const bar =
    planned != null && planned > 0 ? (
      <div>
        <div className="h-3 overflow-hidden rounded-full bg-panel-surface-muted">
          <div
            className="h-full rounded-full bg-[#1c2057]"
            style={{ width: `${spentPct ?? 0}%` }}
            title="Harcanan"
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-panel-fg-secondary">
          <span>Harcanan %{spentPct}</span>
          <span>
            {remainingDays > 0
              ? `${remainingDays} gün kaldı · kalan için günlük ${money((remaining ?? 0) / remainingDays)}`
              : plan.isCurrentMonth
                ? "Son gün"
                : "Dönem kapandı"}
          </span>
        </div>
      </div>
    ) : null;

  if (variant === "compact") {
    return (
      <section className="space-y-4 rounded-panel-lg border border-panel-border bg-panel-surface p-4 shadow-panel sm:p-5">
        {header}
        {statusReasons.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-panel-fg-secondary">
            {statusReasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Planlanan" value={planned != null ? money(planned) : "—"} />
          <MiniStat label="Harcanan" value={money(spent)} />
          <MiniStat label="Kalan" value={remaining != null ? money(remaining) : "—"} />
        </div>
        {bar}
        <p className="text-[11px] text-panel-fg-muted">{spentHint}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {header}

      {statusReasons.length > 0 ? (
        <ul className="space-y-1 rounded-panel-md border border-panel-warn/30 bg-panel-warn-bg px-4 py-3 text-sm text-panel-fg">
          {statusReasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      ) : null}

      {note ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-700">Ajans notu · </span>
          {note}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Planlanan"
          value={planned != null ? money(planned) : "—"}
          hint={dailyAvgPlan != null ? `Günlük ortalama ${money(dailyAvgPlan)}` : "Aylık plan"}
          variant="navy"
        />
        <StatTile
          label="Harcanan"
          value={money(spent)}
          hint={spentHint}
          values={spendSeries}
        />
        <StatTile
          label="Kalan"
          value={remaining != null ? money(remaining) : "—"}
          hint={
            remainingDays > 0 && remaining != null
              ? `${remainingDays} gün · günlük ${money(remaining / remainingDays)}`
              : undefined
          }
        />
      </div>

      {bar}

      {!provider ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            label="Google Ads"
            value={money(summary.google.monthSpend)}
            hint={
              summary.google.plannedMonthly > 0
                ? `Planlanan ${money(summary.google.plannedMonthly)}`
                : "Plan girilmemiş"
            }
            color="#E37400"
            values={[...paceDaily]
              .sort((a, b) => a.date.localeCompare(b.date))
              .filter((d) => d.date <= plan.today)
              .map((d) => d.google)}
          />
          <StatTile
            label="Meta Ads"
            value={money(summary.meta.monthSpend)}
            hint={
              summary.meta.plannedMonthly > 0
                ? `Planlanan ${money(summary.meta.plannedMonthly)}`
                : "Plan girilmemiş"
            }
            color="#0866FF"
            values={[...paceDaily]
              .sort((a, b) => a.date.localeCompare(b.date))
              .filter((d) => d.date <= plan.today)
              .map((d) => d.meta)}
          />
        </div>
      ) : null}

      <div className="rounded-panel-lg border border-panel-border bg-panel-surface p-4 shadow-panel sm:p-5">
        <h4 className="text-sm font-semibold text-panel-fg">
          Birikimli harcama ve plan çizgisi
        </h4>
        <p className="mb-3 mt-0.5 text-xs text-panel-fg-secondary">
          Gün gün toplam harcama · kesikli çizgi planın eşit dağılımı
        </p>
        <CumulativeChart
          from={plan.pace.from}
          to={plan.pace.to}
          today={plan.today}
          planned={planned}
          daily={paceDaily}
          currency={currency}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h4 className="text-sm font-semibold text-zinc-900">
            Aktif kampanyalar
          </h4>
          <p className="text-xs text-zinc-500">
            {activeCampaigns.length} kampanya · kapalı kampanyalar listelenmez
          </p>
        </div>
        {activeCampaigns.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
            Bu dönemde aktif kampanya yok.
          </div>
        ) : (
          <PanelTable
            headers={[
              "Kampanya",
              ...(provider ? [] : ["Platform"]),
              "Planlanan aylık",
              "Harcanan",
              "Kalan",
              "Tempo",
            ]}
            numericCols={provider ? [1, 2, 3, 4] : [2, 3, 4, 5]}
          >
            {activeCampaigns.map((row) => {
              const pace = budgetPacePct(row.monthSpend, row.monthlyBudget);
              return (
                <tr key={`${row.provider}-${row.campaignId}`}>
                  <td className="font-medium text-panel-fg">
                    <span>{displayCampaignName(row)}</span>
                    {isManualCampaignId(row.campaignId) ? (
                      <span className="mt-0.5 block text-[10px] font-normal text-panel-fg-muted">
                        Elle eklendi
                      </span>
                    ) : null}
                  </td>
                  {provider ? null : (
                    <td>{row.provider === "meta" ? "Meta" : "Google"}</td>
                  )}
                  <td className="num">
                    {row.monthlyBudget != null ? money(row.monthlyBudget) : "—"}
                  </td>
                  <td className="num">
                    <DeltaCell value={money(row.monthSpend)} />
                  </td>
                  <td className="num">
                    {row.monthlyBudget != null
                      ? money(Math.max(0, row.monthlyBudget - row.monthSpend))
                      : "—"}
                  </td>
                  <td className={`num font-semibold ${paceClass(pace, plan.warnPct)}`}>
                    {pace == null ? "—" : `%${pace}`}
                  </td>
                </tr>
              );
            })}
          </PanelTable>
        )}
      </div>

      {!provider ? (
        <BudgetYearTable
          slug={plan.slug}
          currency={currency}
          year={plan.year}
          today={plan.today}
          todaySpend={todaySpend}
          focusMonth={plan.month}
          editable={false}
        />
      ) : null}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel-md bg-panel-surface-muted px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-panel-fg-secondary">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-panel-fg">{value}</p>
    </div>
  );
}
