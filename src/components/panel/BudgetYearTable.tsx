"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PaceStatusBadge } from "@/components/panel/BudgetPacingCard";
import {
  computeBudgetPacing,
  type BudgetPaceStatus,
} from "@/lib/panel/budget-pacing";
import { formatTry } from "@/lib/panel/format";
import { buildPeriodHref } from "@/lib/panel/period";
import type { BudgetYear, BudgetYearMonth } from "@/lib/panel/brand-budget";

type Draft = {
  month: string;
  total: string;
  google: string;
  meta: string;
};

function toInput(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseDraft(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const normalized = t.includes(",")
    ? t.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    : t.replace(/\s/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function draftTotal(d: Draft): number | null {
  const total = parseDraft(d.total);
  if (total != null) return total;
  const g = parseDraft(d.google);
  const m = parseDraft(d.meta);
  if (g == null && m == null) return null;
  return (g ?? 0) + (m ?? 0);
}

function endOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

function monthStatus(
  row: BudgetYearMonth,
  planned: number | null,
  today: string,
  todaySpend: number,
): BudgetPaceStatus {
  if (row.phase === "future") return planned != null ? "upcoming" : "none";
  return computeBudgetPacing({
    planned,
    spent: row.googleSpend + row.metaSpend,
    from: `${row.month}-01`,
    to: endOfMonth(row.month),
    today,
    todaySpend: row.phase === "current" ? todaySpend : 0,
  }).status;
}

const inputClass =
  "w-full min-w-[6.5rem] rounded-md border border-zinc-200 bg-white px-2 py-1 text-right text-sm tabular-nums text-zinc-900 outline-none ring-[#e91825]/40 placeholder:text-zinc-400 focus:ring-2";

export default function BudgetYearTable({
  slug,
  currency,
  year,
  today,
  todaySpend,
  focusMonth,
  editable,
}: {
  slug: string;
  currency: string;
  year: BudgetYear;
  today: string;
  /** Güncel ayın bugünkü (kısmi) harcaması. */
  todaySpend: number;
  focusMonth: string;
  editable: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [annual, setAnnual] = useState("");
  const [googlePct, setGooglePct] = useState("");
  const initial = useMemo<Draft[]>(
    () =>
      year.months.map((m) => ({
        month: m.month,
        total: toInput(m.monthlyBudget),
        google: toInput(m.googleBudget),
        meta: toInput(m.metaBudget),
      })),
    [year.months],
  );
  const [drafts, setDrafts] = useState<Draft[]>(initial);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(initial);

  const money = (n: number) => formatTry(n, currency);
  const monthHref = (month: string) =>
    buildPeriodHref(pathname, {
      period: month === today.slice(0, 7) ? "mtd" : "custom",
      start: `${month}-01`,
      end: endOfMonth(month),
    });
  const yearHref = (delta: number) =>
    monthHref(`${year.year + delta}-${focusMonth.slice(5, 7)}`);

  function setCell(month: string, field: keyof Draft, value: string) {
    setDrafts((prev) =>
      prev.map((d) => (d.month === month ? { ...d, [field]: value } : d)),
    );
  }

  function splitChannels(total: number): Pick<Draft, "google" | "meta"> | null {
    const pct = parseDraft(googlePct);
    if (pct == null || pct > 100) return null;
    const google = round2((total * pct) / 100);
    return { google: String(google), meta: String(round2(total - google)) };
  }

  /** Yıllık hedefi, geçmiş ayların planı düşülerek kalan aylara eşit böler. */
  function distributeAnnual() {
    const target = parseDraft(annual);
    if (target == null) {
      setError("Dağıtmak için yıllık bütçe yazın");
      return;
    }
    const open = year.months.filter((m) => m.phase !== "past");
    if (open.length === 0) {
      setError("Bu yılda dağıtılacak ay kalmadı");
      return;
    }
    const pastPlanned = drafts
      .filter((d) => year.months.find((m) => m.month === d.month)?.phase === "past")
      .reduce((sum, d) => sum + (draftTotal(d) ?? 0), 0);
    const per = round2(Math.max(0, target - pastPlanned) / open.length);
    const openSet = new Set(open.map((m) => m.month));
    setError(null);
    setDrafts((prev) =>
      prev.map((d) =>
        openSet.has(d.month)
          ? { ...d, total: String(per), ...(splitChannels(per) ?? {}) }
          : d,
      ),
    );
  }

  /** Odak ayın planını yılın sonraki aylarına kopyalar. */
  function copyForward() {
    const source = drafts.find((d) => d.month === focusMonth);
    if (!source || draftTotal(source) == null) {
      setError("Önce odak ayın planını girin");
      return;
    }
    setError(null);
    setDrafts((prev) =>
      prev.map((d) =>
        d.month > focusMonth
          ? { ...d, total: source.total, google: source.google, meta: source.meta }
          : d,
      ),
    );
  }

  function applySplitToAll() {
    if (parseDraft(googlePct) == null) {
      setError("Google payı % yazın");
      return;
    }
    setError(null);
    setDrafts((prev) =>
      prev.map((d) => {
        const total = draftTotal(d);
        if (total == null) return d;
        return { ...d, total: String(total), ...(splitChannels(total) ?? {}) };
      }),
    );
  }

  async function onSave() {
    if (saving || !editable) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/panel/tenants/${encodeURIComponent(slug)}/budget`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            months: drafts.map((d) => ({
              month: d.month,
              monthlyBudget: d.total,
              googleBudget: d.google,
              metaBudget: d.meta,
            })),
          }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Kaydedilemedi");
        return;
      }
      setMessage(`${year.year} planı kaydedildi.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const rows = year.months.map((m, i) => {
    const d = drafts[i];
    const planned = editable
      ? draftTotal(d)
      : (m.monthlyBudget ??
        (m.googleBudget != null || m.metaBudget != null
          ? (m.googleBudget ?? 0) + (m.metaBudget ?? 0)
          : null));
    const google = editable ? parseDraft(d.google) : m.googleBudget;
    const meta = editable ? parseDraft(d.meta) : m.metaBudget;
    const explicitTotal = editable ? parseDraft(d.total) : m.monthlyBudget;
    const actual = m.googleSpend + m.metaSpend;
    const channelGap =
      explicitTotal != null && (google != null || meta != null)
        ? round2(explicitTotal - (google ?? 0) - (meta ?? 0))
        : 0;
    return {
      m,
      d,
      planned,
      google,
      meta,
      actual,
      channelGap,
      status: monthStatus(m, planned, today, todaySpend),
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.planned += r.planned ?? 0;
      acc.google += r.google ?? 0;
      acc.meta += r.meta ?? 0;
      acc.actual += r.actual;
      if (r.m.phase !== "future") acc.plannedToDate += r.planned ?? 0;
      return acc;
    },
    { planned: 0, google: 0, meta: 0, actual: 0, plannedToDate: 0 },
  );

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Yıllık plan · {year.year}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {editable
              ? "Her ay için ayrı bütçe ve kanal payı · ay adına tıklayınca o ayın detayı açılır"
              : "Ay ay planlanan ve gerçekleşen · ay adına tıklayınca detay açılır"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={yearHref(-1)}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
          >
            ← {year.year - 1}
          </Link>
          <Link
            href={yearHref(1)}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
          >
            {year.year + 1} →
          </Link>
        </div>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <label className="w-36 space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
              Yıllık bütçe
            </span>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="ör. 1500000"
              value={annual}
              onChange={(e) => setAnnual(e.target.value)}
            />
          </label>
          <label className="w-28 space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
              Google payı %
            </span>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="ör. 40"
              value={googlePct}
              onChange={(e) => setGooglePct(e.target.value)}
            />
          </label>
          <ToolButton onClick={distributeAnnual}>
            Kalan aylara eşit dağıt
          </ToolButton>
          <ToolButton onClick={applySplitToAll}>Kanal payını uygula</ToolButton>
          <ToolButton onClick={copyForward}>
            Odak ayı sonraki aylara kopyala
          </ToolButton>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            <tr>
              <th className="px-3 py-2">Ay</th>
              <th className="border-l border-zinc-200 px-3 py-2 text-right text-[#e91825]">
                Plan
              </th>
              <th className="px-3 py-2 text-right">Google</th>
              <th className="px-3 py-2 text-right">Meta</th>
              <th className="border-l border-zinc-200 px-3 py-2 text-right">
                Gerçekleşen
              </th>
              <th className="px-3 py-2 text-right">Fark</th>
              <th className="px-3 py-2">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const pct =
                r.planned != null && r.planned > 0
                  ? Math.round((r.actual / r.planned) * 100)
                  : null;
              const diff =
                r.planned != null && r.m.phase !== "future"
                  ? r.actual - r.planned
                  : null;
              const focus = r.m.month === focusMonth;
              return (
                <tr
                  key={r.m.month}
                  className={
                    focus
                      ? "bg-[#e91825]/[0.03]"
                      : r.m.phase === "future"
                        ? "text-zinc-500"
                        : undefined
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2 align-middle">
                    <Link
                      href={monthHref(r.m.month)}
                      className="font-medium capitalize text-zinc-900 hover:text-[#e91825] hover:underline"
                    >
                      {r.m.label}
                    </Link>
                    {r.m.phase === "current" ? (
                      <span className="ml-1.5 rounded bg-zinc-900 px-1 py-0.5 text-[9px] font-semibold uppercase text-white">
                        Bu ay
                      </span>
                    ) : null}
                  </td>
                  {editable ? (
                    <>
                      <td className="border-l border-zinc-100 px-2 py-1.5">
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          placeholder={
                            r.google != null || r.meta != null
                              ? String((r.google ?? 0) + (r.meta ?? 0))
                              : "—"
                          }
                          value={r.d.total}
                          onChange={(e) =>
                            setCell(r.m.month, "total", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          placeholder="—"
                          value={r.d.google}
                          onChange={(e) =>
                            setCell(r.m.month, "google", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          placeholder="—"
                          value={r.d.meta}
                          onChange={(e) =>
                            setCell(r.m.month, "meta", e.target.value)
                          }
                        />
                        {r.channelGap !== 0 ? (
                          <p className="mt-0.5 text-right text-[10px] text-amber-700">
                            {r.channelGap > 0
                              ? `${money(r.channelGap)} dağıtılmadı`
                              : `Kanallar ${money(-r.channelGap)} fazla`}
                          </p>
                        ) : null}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border-l border-zinc-100 px-3 py-2 text-right font-medium tabular-nums">
                        {r.planned != null ? money(r.planned) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.google != null ? money(r.google) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.meta != null ? money(r.meta) : "—"}
                      </td>
                    </>
                  )}
                  <td className="border-l border-zinc-100 px-3 py-2 text-right align-middle tabular-nums">
                    {r.m.phase === "future" ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <>
                        <span className="font-medium text-zinc-900">
                          {money(r.actual)}
                        </span>
                        {pct != null ? (
                          <span className="mt-1 ml-auto block h-1 w-20 overflow-hidden rounded-full bg-zinc-100">
                            <span
                              className={`block h-full rounded-full ${pct > 100 ? "bg-rose-500" : "bg-zinc-800"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-right align-middle text-xs tabular-nums ${
                      diff == null
                        ? "text-zinc-400"
                        : diff > 0
                          ? "text-rose-600"
                          : "text-zinc-600"
                    }`}
                  >
                    {diff == null
                      ? "—"
                      : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                    {pct != null && r.m.phase !== "future" ? (
                      <span className="block text-[10px] text-zinc-400">
                        %{pct}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <PaceStatusBadge status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-zinc-200 bg-zinc-50 text-sm font-semibold tabular-nums text-zinc-900">
            <tr>
              <td className="px-3 py-2">Yıl toplamı</td>
              <td className="border-l border-zinc-200 px-3 py-2 text-right">
                {totals.planned > 0 ? money(totals.planned) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {totals.google > 0 ? money(totals.google) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {totals.meta > 0 ? money(totals.meta) : "—"}
              </td>
              <td className="border-l border-zinc-200 px-3 py-2 text-right">
                {money(totals.actual)}
              </td>
              <td className="px-3 py-2 text-right text-xs font-medium text-zinc-600">
                {totals.plannedToDate > 0
                  ? `Bugüne kadar plan ${money(totals.plannedToDate)}`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-xs font-medium text-zinc-600">
                {totals.planned > 0
                  ? `Yılın %${Math.round((totals.actual / totals.planned) * 100)}’i harcandı`
                  : ""}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Plan boşsa Google + Meta toplamı plan sayılır. Günlük plan ve
            notlar korunur.
          </p>
          <div className="flex items-center gap-2">
            {dirty ? (
              <button
                type="button"
                onClick={() => setDrafts(initial)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-300"
              >
                Geri al
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving || pending || !dirty}
              onClick={onSave}
              className="rounded-md bg-[#e91825] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d01420] disabled:opacity-60"
            >
              {saving || pending ? "Kaydediliyor…" : "Yıllık planı kaydet"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}

function ToolButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:border-zinc-300"
    >
      {children}
    </button>
  );
}
