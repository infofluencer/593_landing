"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BudgetPacingCard from "@/components/panel/BudgetPacingCard";
import BudgetYearTable from "@/components/panel/BudgetYearTable";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { formatTry } from "@/lib/panel/format";
import {
  budgetPacePct,
  summarizeBudgetPlan,
  type BrandBudgetPlan,
} from "@/lib/panel/brand-budget";

function moneyToInput(value: number | null): string {
  if (value == null) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

function parseDraft(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const normalized = t.includes(",")
    ? t.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    : t.replace(/\s/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function paceTone(pct: number | null, warnPct: number): string {
  if (pct == null) return "text-zinc-400";
  if (pct >= 100) return "text-rose-600";
  if (pct >= warnPct) return "text-amber-600";
  return "text-emerald-700";
}

const inputClass =
  "w-full min-w-[6.5rem] rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums text-zinc-900 outline-none ring-[#e91825]/40 placeholder:text-zinc-400 focus:ring-2";

const nameInputClass =
  "w-full min-w-[10rem] rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none ring-[#e91825]/40 placeholder:text-zinc-400 focus:ring-2";

export default function BrandBudgetPlanner({
  plan,
  existsInDb,
}: {
  plan: BrandBudgetPlan | null;
  existsInDb: boolean;
}) {
  if (!existsInDb || !plan) {
    return (
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Planlanan ve gerçekleşen
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Kampanya bütçesini siz yazarsınız. Harcama Meta / Google sync’ten
            gelir.
          </p>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Bu marka henüz DB’de yok. Bütçe yazmak için önce seed veya Meta
          provision çalıştırın.
        </p>
      </section>
    );
  }

  const todayRow = plan.pace.daily.find((d) => d.date === plan.today);
  return (
    <>
      <PlannerForm
        key={`${plan.rangeFrom}-${plan.rangeTo}-${JSON.stringify(plan.brand)}`}
        plan={plan}
      />
      <BudgetYearTable
        key={`${plan.year.year}-${JSON.stringify(plan.year.months)}`}
        slug={plan.slug}
        currency={plan.currency}
        year={plan.year}
        today={plan.today}
        todaySpend={todayRow ? todayRow.google + todayRow.meta : 0}
        focusMonth={plan.month}
        editable
      />
    </>
  );
}

function PlannerForm({ plan }: { plan: BrandBudgetPlan }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [brandMonthly, setBrandMonthly] = useState(
    moneyToInput(plan.brand.monthlyBudget),
  );
  const [brandDaily, setBrandDaily] = useState(
    moneyToInput(plan.brand.dailyBudget),
  );
  const [brandGoogle, setBrandGoogle] = useState(
    moneyToInput(plan.brand.googleBudget),
  );
  const [brandMeta, setBrandMeta] = useState(
    moneyToInput(plan.brand.metaBudget),
  );
  const [brandNote, setBrandNote] = useState(plan.brand.note);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(
    () =>
      summarizeBudgetPlan(
        plan.canEdit
          ? {
              monthlyBudget: parseDraft(brandMonthly),
              dailyBudget: parseDraft(brandDaily),
              googleBudget: parseDraft(brandGoogle),
              metaBudget: parseDraft(brandMeta),
            }
          : plan.rangeBrand,
        plan.campaigns,
      ),
    [
      brandDaily,
      brandGoogle,
      brandMeta,
      brandMonthly,
      plan.campaigns,
      plan.canEdit,
      plan.rangeBrand,
    ],
  );

  const channelSum =
    parseDraft(brandGoogle) != null || parseDraft(brandMeta) != null
      ? (parseDraft(brandGoogle) ?? 0) + (parseDraft(brandMeta) ?? 0)
      : null;
  const suggestedDaily =
    summary.plannedMonthly != null && summary.plannedMonthly > 0
      ? summary.plannedMonthly / plan.daysInMonth
      : null;

  async function onSave() {
    if (saving || !plan.canEdit) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(plan.slug)}/budget`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: plan.month,
            monthlyBudget: brandMonthly,
            dailyBudget: brandDaily,
            googleBudget: brandGoogle,
            metaBudget: brandMeta,
            note: brandNote,
          }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Kaydedilemedi");
        return;
      }
      setMessage("Planlanan bütçe kaydedildi.");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="butce"
      className="scroll-mt-24 space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Planlanan ve gerçekleşen
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Bütçeyi siz belirlersiniz · harcama API’den gelir · {plan.rangeLabel}
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={plan.rangeLabel} />
      </Suspense>

      {plan.canEdit ? null : (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          Birden fazla ay seçili — plan toplamı gösterilir. Düzenlemek için
          “Bu ay” veya tek ay seçin.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-[#e91825]/20 bg-[#e91825]/[0.03] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e91825]">
            Planlanan
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {plan.canEdit
              ? `${plan.monthLabel} için hedef bütçe`
              : "Seçili ayların plan toplamı"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MoneyField
              label="Aylık"
              placeholder={
                channelSum != null ? String(channelSum) : "ör. 120000"
              }
              disabled={!plan.canEdit}
              value={plan.canEdit ? brandMonthly : moneyToInput(plan.rangeBrand.monthlyBudget)}
              onChange={setBrandMonthly}
            />
            <MoneyField
              label="Günlük"
              placeholder={
                suggestedDaily != null
                  ? `öneri ${Math.round(suggestedDaily)}`
                  : "ör. 4000"
              }
              disabled={!plan.canEdit}
              value={plan.canEdit ? brandDaily : moneyToInput(plan.rangeBrand.dailyBudget)}
              onChange={setBrandDaily}
            />
            <MoneyField
              label="Google Ads payı"
              placeholder="—"
              disabled={!plan.canEdit}
              value={plan.canEdit ? brandGoogle : moneyToInput(plan.rangeBrand.googleBudget)}
              onChange={setBrandGoogle}
            />
            <MoneyField
              label="Meta Ads payı"
              placeholder="—"
              disabled={!plan.canEdit}
              value={plan.canEdit ? brandMeta : moneyToInput(plan.rangeBrand.metaBudget)}
              onChange={setBrandMeta}
            />
          </div>

          {summary.plannedMonthly != null && summary.plannedMonthly > 0 ? (
            <ChannelSplitBar
              total={summary.plannedMonthly}
              google={parseDraft(brandGoogle) ?? 0}
              meta={parseDraft(brandMeta) ?? 0}
              currency={plan.currency}
              show={plan.canEdit && channelSum != null}
            />
          ) : null}

          {plan.canEdit ? (
            <label className="mt-3 block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                Not
              </span>
              <input
                className={nameInputClass}
                maxLength={500}
                placeholder="ör. Kampanya dönemi — 15’inden sonra Meta ağırlıklı"
                value={brandNote}
                onChange={(e) => setBrandNote(e.target.value)}
              />
            </label>
          ) : null}

          {summary.campaignMonthly > 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              Kampanya toplamı{" "}
              <span className="font-medium text-zinc-700">
                {formatTry(summary.campaignMonthly, plan.currency)}
              </span>
              {summary.campaignDaily > 0 ? (
                <>
                  {" "}
                  · günlük{" "}
                  <span className="font-medium text-zinc-700">
                    {formatTry(summary.campaignDaily, plan.currency)}
                  </span>
                </>
              ) : null}
              {summary.plannedMonthly != null &&
              Math.abs(summary.campaignMonthly - summary.plannedMonthly) >= 1 ? (
                <span className="text-amber-700">
                  {" "}
                  · marka planından{" "}
                  {formatTry(
                    Math.abs(summary.campaignMonthly - summary.plannedMonthly),
                    plan.currency,
                  )}{" "}
                  {summary.campaignMonthly > summary.plannedMonthly
                    ? "fazla"
                    : "eksik"}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Gerçekleşen
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Meta + Google harcaması
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                Ay içi
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-900">
                {formatTry(summary.monthSpend, plan.currency)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                Günlük ortalama
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-900">
                {formatTry(
                  summary.monthSpend / Math.max(1, plan.daysElapsed),
                  plan.currency,
                )}
              </p>
              {plan.isCurrentMonth ? (
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Bugün {formatTry(summary.todaySpend, plan.currency)}
                </p>
              ) : null}
            </div>
          </div>
          <p className={`mt-3 text-sm font-semibold tabular-nums ${paceTone(summary.pacePct, plan.warnPct)}`}>
            {summary.pacePct == null
              ? "Plan yok — tempo hesaplanmadı"
              : `%${summary.pacePct} tempo · kalan ${formatTry(summary.remaining ?? 0, plan.currency)}`}
          </p>
        </div>
      </div>

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
        daily={plan.pace.daily}
        currency={plan.currency}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelCompare
          label="Google Ads"
          planned={summary.google.plannedMonthly}
          realized={summary.google.monthSpend}
          currency={plan.currency}
          warnPct={plan.warnPct}
        />
        <ChannelCompare
          label="Meta Ads"
          planned={summary.meta.plannedMonthly}
          realized={summary.meta.monthSpend}
          currency={plan.currency}
          warnPct={plan.warnPct}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {plan.canEdit
            ? "Planlanan rakam Ads’e yazılmaz."
            : "Bu aralıkta düzenleme yok — tek ay seçin."}
        </p>
        <button
          type="button"
          disabled={saving || pending || !plan.canEdit}
          onClick={onSave}
          className="rounded-md bg-[#e91825] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d01420] disabled:opacity-60"
        >
          {saving || pending ? "Kaydediliyor…" : "Planı kaydet"}
        </button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}

function ChannelCompare({
  label,
  planned,
  realized,
  currency,
  warnPct,
}: {
  label: string;
  planned: number;
  realized: number;
  currency: string;
  warnPct: number;
}) {
  const pace = budgetPacePct(realized, planned > 0 ? planned : null);
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[#e91825]">
            Planlanan
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
            {planned > 0 ? formatTry(planned, currency) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            Gerçekleşen
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
            {formatTry(realized, currency)}
          </p>
        </div>
      </div>
      <p className={`mt-2 text-xs font-semibold tabular-nums ${paceTone(pace, warnPct)}`}>
        {pace == null ? "Plan yok" : `%${pace} tempo`}
      </p>
    </div>
  );
}

function MoneyField({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </span>
      <input
        className={inputClass}
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Aylık planın kanal dağılımı — Google / Meta / dağıtılmamış. */
function ChannelSplitBar({
  total,
  google,
  meta,
  currency,
  show,
}: {
  total: number;
  google: number;
  meta: number;
  currency: string;
  show: boolean;
}) {
  if (!show) return null;
  const rest = total - google - meta;
  const max = Math.max(total, google + meta);
  const pct = (n: number) => `${(Math.max(0, n) / max) * 100}%`;
  return (
    <div className="mt-3">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-zinc-100">
        {google > 0 ? (
          <div className="h-full bg-emerald-600" style={{ width: pct(google) }} />
        ) : null}
        {meta > 0 ? (
          <div className="h-full bg-blue-600" style={{ width: pct(meta) }} />
        ) : null}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-600" />
          Google %{Math.round((google / total) * 100)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-blue-600" />
          Meta %{Math.round((meta / total) * 100)}
        </span>
        {Math.abs(rest) >= 1 ? (
          <span className="font-medium text-amber-700">
            {rest > 0
              ? `${formatTry(rest, currency)} dağıtılmadı`
              : `Kanallar plandan ${formatTry(-rest, currency)} fazla`}
          </span>
        ) : null}
      </p>
    </div>
  );
}
