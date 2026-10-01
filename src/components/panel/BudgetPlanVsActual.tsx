import Link from "next/link";
import BudgetPacingCard, {
  PaceStatusBadge,
} from "@/components/panel/BudgetPacingCard";
import BudgetYearTable from "@/components/panel/BudgetYearTable";
import { BudgetBar, KPICard } from "@/components/panel/ds";
import { PanelTable } from "@/components/panel/ui";
import {
  budgetPacePct,
  displayCampaignName,
  isManualCampaignId,
  summarizeBudgetPlan,
  type BrandBudgetPlan,
  type BudgetProvider,
} from "@/lib/panel/brand-budget";
import { computeBudgetPacing } from "@/lib/panel/budget-pacing";
import { formatTry } from "@/lib/panel/format";

function paceClass(pct: number | null, warnPct: number): string {
  if (pct == null) return "text-panel-fg-muted";
  if (pct >= 100) return "text-panel-critical";
  if (pct >= warnPct) return "text-panel-warn";
  return "text-panel-ok";
}

/** Marka paneli — planlanan vs gerçekleşen. Salt okuma, düzenleme yok. */
export default function BudgetPlanVsActual({
  plan,
  variant = "full",
  provider,
}: {
  plan: BrandBudgetPlan;
  variant?: "full" | "compact";
  provider?: BudgetProvider;
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
  const note = plan.canEdit ? plan.brand.note.trim() : "";
  const currency = plan.currency;
  const channelLabel =
    provider === "meta" ? "Meta" : provider === "google" ? "Google Ads" : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-panel-fg">
              Planlanan ve gerçekleşen
              {channelLabel ? ` · ${channelLabel}` : ""}
            </h3>
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              İnceleme
            </span>
            <PaceStatusBadge status={pacing.status} />
          </div>
          <p className="mt-0.5 text-xs text-panel-fg-secondary">
            Plan ajans tarafından belirlenir · burada yalnızca izlenir ·{" "}
            {plan.rangeLabel}
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

      {note ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-700">Ajans notu · </span>
          {note}
        </p>
      ) : null}

      {variant === "compact" ? (
        <BudgetBar
          realized={summary.monthSpend}
          target={summary.plannedMonthly}
          currency={currency}
        />
      ) : (
        <BudgetPacingCard
          title={
            plan.months.length > 1
              ? `Bütçe temposu · ${plan.months.length} ay`
              : `Bütçe temposu · ${plan.monthLabel}`
          }
          planned={summary.plannedMonthly}
          from={plan.pace.from}
          to={plan.pace.to}
          today={plan.today}
          daily={paceDaily}
          currency={currency}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          tier={2}
          metricKey="spend"
          kind="money"
          label="Planlanan"
          accent="var(--panel-accent)"
          value={
            summary.plannedMonthly != null
              ? formatTry(summary.plannedMonthly, currency)
              : "—"
          }
          hint={
            <span className="text-[11px] text-panel-fg-secondary">
              {summary.plannedDaily != null
                ? `Günlük ${formatTry(summary.plannedDaily, currency)}`
                : "Aylık plan"}
            </span>
          }
          goodDirection="neutral"
        />
        <KPICard
          tier={2}
          metricKey="spend"
          kind="money"
          label="Gerçekleşen"
          value={formatTry(summary.monthSpend, currency)}
          hint={
            plan.isCurrentMonth ? (
              <span className="text-[11px] text-panel-fg-secondary">
                Bugün {formatTry(summary.todaySpend, currency)}
              </span>
            ) : (
              <span className="text-[11px] text-panel-fg-secondary">
                {plan.rangeLabel}
              </span>
            )
          }
          goodDirection="neutral"
        />
        {!provider ? (
          <>
            <KPICard
              tier={2}
              metricKey="spend"
              kind="money"
              label="Google Ads"
              accent="var(--panel-google-blue)"
              value={formatTry(summary.google.monthSpend, currency)}
              hint={
                <span className="text-[11px] text-panel-fg-secondary">
                  Planlanan{" "}
                  {summary.google.plannedMonthly > 0
                    ? formatTry(summary.google.plannedMonthly, currency)
                    : "—"}
                </span>
              }
              goodDirection="neutral"
            />
            <KPICard
              tier={2}
              metricKey="spend"
              kind="money"
              label="Meta Ads"
              accent="var(--panel-meta)"
              value={formatTry(summary.meta.monthSpend, currency)}
              hint={
                <span className="text-[11px] text-panel-fg-secondary">
                  Planlanan{" "}
                  {summary.meta.plannedMonthly > 0
                    ? formatTry(summary.meta.plannedMonthly, currency)
                    : "—"}
                </span>
              }
              goodDirection="neutral"
            />
          </>
        ) : (
          <>
            <KPICard
              tier={2}
              kind="money"
              label="Kalan"
              value={
                summary.remaining != null
                  ? formatTry(summary.remaining, currency)
                  : "—"
              }
              goodDirection="neutral"
            />
            <KPICard
              tier={2}
              kind="rate"
              label="Tempo"
              value={summary.pacePct == null ? "—" : `%${summary.pacePct}`}
              goodDirection="neutral"
            />
          </>
        )}
      </div>

      {variant === "compact" ? null : (
        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-900">
              Kampanya incelemesi
            </h4>
            <p className="text-xs text-zinc-500">Düzenleme yok</p>
          </div>
          {campaigns.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
              Bu ay için kampanya satırı yok.
            </div>
          ) : (
            <PanelTable
              headers={[
                "Kampanya",
                ...(provider ? [] : ["Platform"]),
                "Hedef kitle",
                "Konum",
                "Planlanan günlük",
                "Planlanan aylık",
                "Gerçekleşen günlük",
                "Gerçekleşen",
                "Tempo",
              ]}
              numericCols={provider ? [3, 4, 5, 6, 7] : [4, 5, 6, 7, 8]}
            >
              {(["active", "inactive"] as const).flatMap((group) => {
                const rows = campaigns.filter((row) =>
                  group === "active" ? row.active : !row.active,
                );
                if (rows.length === 0) return [];
                const colSpan = provider ? 8 : 9;
                return [
                  <tr key={group} className="bg-zinc-50">
                    <td
                      colSpan={colSpan}
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                    >
                      {group === "active" ? "Aktif · planlanan" : "Aktif değil"}
                      <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-400">
                        {rows.length}
                      </span>
                    </td>
                  </tr>,
                  ...rows.map((row) => {
                    const pace = budgetPacePct(row.monthSpend, row.monthlyBudget);
                    return (
                      <tr
                        key={`${row.provider}-${row.campaignId}`}
                        className={row.active ? undefined : "text-zinc-500"}
                      >
                        <td className="font-medium text-panel-fg">
                          <span>{displayCampaignName(row)}</span>
                          {isManualCampaignId(row.campaignId) ? (
                            <span className="mt-0.5 block text-[10px] font-normal text-panel-fg-muted">
                              Elle eklendi
                            </span>
                          ) : row.label?.trim() &&
                            row.label.trim() !== row.campaignName ? (
                            <span className="mt-0.5 block text-[10px] font-normal text-panel-fg-muted">
                              {row.campaignName}
                            </span>
                          ) : null}
                        </td>
                        {provider ? null : (
                          <td>{row.provider === "meta" ? "Meta" : "Google"}</td>
                        )}
                        <td>{row.audience?.trim() || "—"}</td>
                        <td>{row.location?.trim() || "—"}</td>
                        <td className="num">
                          {row.dailyBudget != null
                            ? formatTry(row.dailyBudget, currency)
                            : "—"}
                        </td>
                        <td className="num">
                          {row.monthlyBudget != null
                            ? formatTry(row.monthlyBudget, currency)
                            : "—"}
                        </td>
                        <td className="num">
                          {formatTry(row.avgDailySpend, currency)}
                          {plan.isCurrentMonth ? (
                            <span className="mt-0.5 block text-[10px] font-normal text-panel-fg-muted">
                              Bugün {formatTry(row.todaySpend, currency)}
                            </span>
                          ) : null}
                        </td>
                        <td className="num">
                          {formatTry(row.monthSpend, currency)}
                        </td>
                        <td
                          className={`num font-semibold ${paceClass(pace, plan.warnPct)}`}
                        >
                          {pace == null ? "—" : `%${pace}`}
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </PanelTable>
          )}
        </div>
      )}

      {variant === "full" && !provider ? (
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
