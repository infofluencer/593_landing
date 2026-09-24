"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { formatTry } from "@/lib/panel/format";
import {
  budgetPacePct,
  isManualCampaignId,
  summarizeBudgetPlan,
  type BrandBudgetPlan,
  type BudgetProvider,
} from "@/lib/panel/brand-budget";

type Filter = "all" | BudgetProvider;

type DraftRow = {
  provider: BudgetProvider;
  campaignId: string;
  campaignName: string;
  label: string;
  audience: string;
  location: string;
  monthly: string;
  daily: string;
  monthSpend: number;
  todaySpend: number;
  avgDailySpend: number;
};

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

  return <PlannerForm key={`${plan.rangeFrom}-${plan.rangeTo}`} plan={plan} />;
}

function PlannerForm({ plan }: { plan: BrandBudgetPlan }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [brandMonthly, setBrandMonthly] = useState(
    moneyToInput(plan.brand.monthlyBudget),
  );
  const [brandDaily, setBrandDaily] = useState(
    moneyToInput(plan.brand.dailyBudget),
  );
  const [rows, setRows] = useState<DraftRow[]>(() =>
    plan.campaigns.map((c) => ({
      provider: c.provider,
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      label: c.label ?? "",
      audience: c.audience ?? "",
      location: c.location ?? "",
      monthly: moneyToInput(c.monthlyBudget),
      daily: moneyToInput(c.dailyBudget),
      monthSpend: c.monthSpend,
      todaySpend: c.todaySpend,
      avgDailySpend: c.avgDailySpend,
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<
    Array<{ provider: BudgetProvider; campaignId: string }>
  >([]);
  const [draftName, setDraftName] = useState("");
  const [draftProvider, setDraftProvider] = useState<BudgetProvider>("meta");

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.provider === filter)),
    [filter, rows],
  );

  const summary = useMemo(
    () =>
      summarizeBudgetPlan(
        plan.canEdit
          ? {
              monthlyBudget: parseDraft(brandMonthly),
              dailyBudget: parseDraft(brandDaily),
            }
          : plan.rangeBrand,
        rows.map((row) => ({
          provider: row.provider,
          monthlyBudget: parseDraft(row.monthly),
          dailyBudget: parseDraft(row.daily),
          monthSpend: row.monthSpend,
          todaySpend: row.todaySpend,
        })),
      ),
    [brandDaily, brandMonthly, plan.canEdit, plan.rangeBrand, rows],
  );

  function setRow(
    provider: BudgetProvider,
    campaignId: string,
    field: "monthly" | "daily" | "label" | "audience" | "location",
    value: string,
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.provider === provider && row.campaignId === campaignId
          ? { ...row, [field]: value }
          : row,
      ),
    );
  }

  function addManualCampaign() {
    const name = draftName.trim();
    if (!name) {
      setError("Elle eklemek için kampanya adı yazın");
      return;
    }
    const campaignId = `manual_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    setError(null);
    setRows((prev) => [
      {
        provider: draftProvider,
        campaignId,
        campaignName: name,
        label: name,
        audience: "",
        location: "",
        monthly: "",
        daily: "",
        monthSpend: 0,
        todaySpend: 0,
        avgDailySpend: 0,
      },
      ...prev,
    ]);
    setDraftName("");
  }

  function removeManualCampaign(provider: BudgetProvider, campaignId: string) {
    setRows((prev) =>
      prev.filter(
        (row) => !(row.provider === provider && row.campaignId === campaignId),
      ),
    );
    setRemoved((prev) => [...prev, { provider, campaignId }]);
  }

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
            campaigns: rows.map((row) => ({
              provider: row.provider,
              campaignId: row.campaignId,
              campaignName: row.campaignName,
              label: row.label,
              audience: row.audience,
              location: row.location,
              monthlyBudget: row.monthly,
              dailyBudget: row.daily,
            })),
            removeCampaigns: removed,
          }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Kaydedilemedi");
        return;
      }
      setMessage("Planlanan bütçe kaydedildi.");
      setRemoved([]);
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
            Sizin girdiğiniz hedef bütçe
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                Aylık
              </span>
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="ör. 120000"
                disabled={!plan.canEdit}
                value={brandMonthly}
                onChange={(e) => setBrandMonthly(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                Günlük
              </span>
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="ör. 4000"
                disabled={!plan.canEdit}
                value={brandDaily}
                onChange={(e) => setBrandDaily(e.target.value)}
              />
            </label>
          </div>
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

      {summary.plannedMonthly != null && summary.plannedMonthly > 0 ? (
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full ${
              summary.pacePct != null && summary.pacePct >= 100
                ? "bg-rose-500"
                : summary.pacePct != null && summary.pacePct >= plan.warnPct
                  ? "bg-amber-400"
                  : "bg-zinc-800"
            }`}
            style={{ width: `${Math.min(100, summary.pacePct ?? 0)}%` }}
          />
        </div>
      ) : null}

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
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            Kampanya planı
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            API’den gelenler + elle eklenen plan kampanyaları
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "Tümü"],
              ["meta", "Meta"],
              ["google", "Google"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                filter === id
                  ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="pl-1 text-[11px] text-zinc-500">
            {plan.isCurrentMonth
              ? `${plan.dayOfMonth}/${plan.daysInMonth} gün`
              : `${plan.daysInMonth} gün`}
          </span>
        </div>
      </div>

      {plan.canEdit ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <label className="min-w-[7rem] space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
              Platform
            </span>
            <select
              className={nameInputClass}
              value={draftProvider}
              onChange={(e) =>
                setDraftProvider(e.target.value as BudgetProvider)
              }
            >
              <option value="meta">Meta</option>
              <option value="google">Google</option>
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
              Yeni kampanya
            </span>
            <input
              className={nameInputClass}
              placeholder="API’de yok — plan için ad yazın"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManualCampaign();
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={addManualCampaign}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:border-zinc-300"
          >
            Kampanya ekle
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Bu dönemde API kampanyası yok. Yukarıdan plan kampanyası
          ekleyebilirsiniz.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
              <tr>
                <th className="px-3 py-2" rowSpan={2}>
                  Kampanya
                </th>
                <th className="px-3 py-2" rowSpan={2}>
                  Platform
                </th>
                <th
                  className="border-l border-zinc-200 px-3 py-2 text-center text-[#e91825]"
                  colSpan={2}
                >
                  Planlama
                </th>
                <th
                  className="border-l border-zinc-200 px-3 py-2 text-center text-[#e91825]"
                  colSpan={2}
                >
                  Planlanan
                </th>
                <th
                  className="border-l border-zinc-200 px-3 py-2 text-center"
                  colSpan={2}
                >
                  Gerçekleşen
                </th>
                <th className="border-l border-zinc-200 px-3 py-2 text-right" rowSpan={2}>
                  Tempo
                </th>
              </tr>
              <tr>
                <th className="border-l border-zinc-200 px-3 py-2">
                  Hedef kitle
                </th>
                <th className="px-3 py-2">Konum</th>
                <th className="border-l border-zinc-200 px-3 py-2 text-right">
                  Günlük
                </th>
                <th className="px-3 py-2 text-right">Aylık</th>
                <th className="border-l border-zinc-200 px-3 py-2 text-right">
                  Günlük
                </th>
                <th className="px-3 py-2 text-right">Ay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((row) => {
                const monthly = parseDraft(row.monthly);
                const rowPace = budgetPacePct(row.monthSpend, monthly);
                return (
                  <tr key={`${row.provider}-${row.campaignId}`}>
                    <td className="min-w-[14rem] max-w-[20rem] px-3 py-2 align-middle">
                      <input
                        className={nameInputClass}
                        placeholder={row.campaignName}
                        disabled={!plan.canEdit}
                        value={row.label}
                        onChange={(e) =>
                          setRow(
                            row.provider,
                            row.campaignId,
                            "label",
                            e.target.value,
                          )
                        }
                      />
                      {isManualCampaignId(row.campaignId) ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                            Elle eklendi
                          </span>
                          {plan.canEdit ? (
                            <button
                              type="button"
                              onClick={() =>
                                removeManualCampaign(row.provider, row.campaignId)
                              }
                              className="text-[10px] font-medium text-rose-600 hover:underline"
                            >
                              Kaldır
                            </button>
                          ) : null}
                        </div>
                      ) : row.label.trim() &&
                        row.label.trim() !== row.campaignName ? (
                        <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                          API: {row.campaignName}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-zinc-400">
                          Görünen adı özelleştir
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          row.provider === "meta"
                            ? "bg-blue-50 text-blue-800"
                            : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {row.provider === "meta" ? "Meta" : "Google"}
                      </span>
                    </td>
                    <td className="border-l border-zinc-100 px-3 py-2 align-middle">
                      <input
                        className={nameInputClass}
                        placeholder="ör. 25–34, kadın"
                        disabled={!plan.canEdit}
                        value={row.audience}
                        onChange={(e) =>
                          setRow(
                            row.provider,
                            row.campaignId,
                            "audience",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        className={nameInputClass}
                        placeholder="ör. İstanbul, Ankara"
                        disabled={!plan.canEdit}
                        value={row.location}
                        onChange={(e) =>
                          setRow(
                            row.provider,
                            row.campaignId,
                            "location",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td className="border-l border-zinc-100 px-3 py-2 align-middle">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        placeholder="—"
                        disabled={!plan.canEdit}
                        value={row.daily}
                        onChange={(e) =>
                          setRow(row.provider, row.campaignId, "daily", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        placeholder="—"
                        disabled={!plan.canEdit}
                        value={row.monthly}
                        onChange={(e) =>
                          setRow(
                            row.provider,
                            row.campaignId,
                            "monthly",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td className="border-l border-zinc-100 px-3 py-2 text-right align-middle tabular-nums text-zinc-800">
                      {formatTry(row.avgDailySpend, plan.currency)}
                      {plan.isCurrentMonth ? (
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          Bugün {formatTry(row.todaySpend, plan.currency)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right align-middle font-medium tabular-nums text-zinc-800">
                      {formatTry(row.monthSpend, plan.currency)}
                    </td>
                    <td
                      className={`border-l border-zinc-100 px-3 py-2 text-right align-middle text-xs font-semibold tabular-nums ${paceTone(rowPace, plan.warnPct)}`}
                    >
                      {rowPace == null ? "—" : `%${rowPace}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {plan.canEdit
            ? "Planlanan rakam Ads’e yazılmaz. Boş satır plansız kalır."
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
        {pace == null ? "Kampanya planı yok" : `%${pace} tempo`}
      </p>
    </div>
  );
}
