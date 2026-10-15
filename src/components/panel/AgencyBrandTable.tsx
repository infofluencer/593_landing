"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { AlertSeverity } from "@prisma/client";
import {
  AgencyResultsCard,
  AgencyTodayCard,
} from "@/components/panel/AgencyBrandCharts";
import AgencyBrandRowDetail from "@/components/panel/AgencyBrandRowDetail";
import { StatusBadge } from "@/components/panel/StatusBadge";
import {
  btnGhost,
  chipClass,
  fieldClass,
} from "@/components/panel/ds/buttons";
import { brandInitials, resolveBrandCover } from "@/lib/panel/brand-logos";
import {
  missingProviders,
  noSpendToday,
  paymentIssue,
} from "@/lib/panel/brand-table-utils";
import type { AgencyResults } from "@/lib/panel/agency-results";
import type { BrandTableRow, TokenState } from "@/lib/panel/brand-table";
import { PACE_STATUS_META, type PaceTone } from "@/lib/panel/budget-pacing";
import { formatDateTime, formatTry } from "@/lib/panel/format";
import { GOOGLE_COLOR, META_COLOR } from "@/components/panel/ds/chart-theme";
import { PlatformBadge } from "@/components/panel/ds/platform-icons";

type SortKey =
  | "name"
  | "health"
  | "budget"
  | "pace"
  | "today"
  | "sync"
  | "owner";
type SortState = { key: SortKey; dir: "asc" | "desc" };
type HealthFilter = "" | AlertSeverity;


const HEALTH_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  unknown: 1,
  warn: 2,
  ok: 3,
};

const HEALTH_META: Record<
  AlertSeverity,
  { label: string; fill: string; Icon: LucideIcon }
> = {
  critical: { label: "Kritik", fill: "var(--panel-critical)", Icon: XCircle },
  warn: { label: "Uyarı", fill: "var(--panel-warn)", Icon: AlertTriangle },
  unknown: {
    label: "Bilinmiyor",
    fill: "var(--panel-fg-muted)",
    Icon: CircleHelp,
  },
  ok: { label: "Sağlıklı", fill: "var(--panel-ok)", Icon: CheckCircle2 },
};

const HEALTH_ORDER: AlertSeverity[] = ["critical", "warn", "unknown", "ok"];

/** Tempo / durum tonu → metin rengi. */
const TONE_TEXT: Record<PaceTone, string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  critical: "text-rose-700",
  muted: "text-zinc-500",
};

const TONE_CHIP: Record<PaceTone, string> = {
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  critical: "bg-rose-50 text-rose-800 ring-rose-200",
  muted: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const TOKEN_META: Record<TokenState, { label: string; tone: PaceTone }> = {
  ok: { label: "Geçerli", tone: "ok" },
  token: { label: "Token hatası", tone: "critical" },
  permission: { label: "Erişim yok", tone: "warn" },
  none: { label: "—", tone: "muted" },
};

const SORT_KEYS: SortKey[] = [
  "name",
  "health",
  "budget",
  "pace",
  "today",
  "sync",
  "owner",
];

function readParam(sp: URLSearchParams, key: string): string {
  return sp.get(key)?.trim() ?? "";
}

function budgetPct(r: BrandTableRow): number | null {
  return r.planned && r.planned > 0 ? (r.spent / r.planned) * 100 : null;
}

/** Ödeme sorunu (0) < bugün harcama yok (1) < normal (2). */
function todayRank(r: BrandTableRow): number {
  if (paymentIssue(r)) return 0;
  if (noSpendToday(r)) return 1;
  return 2;
}


function compare(a: BrandTableRow, b: BrandTableRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, "tr");
    case "health":
      return (
        HEALTH_RANK[a.health ?? "unknown"] - HEALTH_RANK[b.health ?? "unknown"]
      );
    case "budget":
      return (budgetPct(a) ?? -1) - (budgetPct(b) ?? -1);
    case "pace":
      return (a.projectedPct ?? -1) - (b.projectedPct ?? -1);
    case "today":
      // Ödeme sorunu olanlar en üstte (artan sırada).
      return todayRank(a) - todayRank(b) || a.todaySpend - b.todaySpend;
    case "sync":
      return (a.lastSyncAt ?? "").localeCompare(b.lastSyncAt ?? "");
    case "owner":
      // Atanmamışlar sona.
      return (a.owner?.label ?? "\uffff").localeCompare(
        b.owner?.label ?? "\uffff",
        "tr",
      );
  }
}

function compactTry(value: number, currency: string): string {
  // Para biçimi compactDisplay'i yok sayıp "₺5,7 B" (bin) veriyor — milyar sanılıyor.
  const symbol =
    new Intl.NumberFormat("tr-TR", { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency;
  const n = new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    compactDisplay: "long",
    maximumFractionDigits: 1,
  }).format(value);
  return `${symbol}${n}`;
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={`px-3 py-3 text-left font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        title={`${label} sütununa göre sırala`}
        className={`-mx-1 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 whitespace-nowrap transition ${
          active
            ? "border-[#141111] bg-[#141111] text-white"
            : "border-zinc-300/80 bg-white/70 text-zinc-700 hover:border-[#141111] hover:bg-white hover:text-[#141111]"
        }`}
      >
        {label}
        {active ? (
          <Icon className="size-3.5" aria-hidden />
        ) : (
          <ArrowUpDown className="size-3.5 text-zinc-400" aria-hidden />
        )}
        <span className="sr-only">
          {active
            ? sort.dir === "asc"
              ? " (artan sıralı)"
              : " (azalan sıralı)"
            : " (sıralamak için tıklayın)"}
        </span>
      </button>
    </th>
  );
}

export default function AgencyBrandTable({
  rows,
  monthLabel,
  today,
  daysInMonth,
  currentHour,
  hourlySync,
  results,
  staff,
}: {
  rows: BrandTableRow[];
  monthLabel: string;
  today: string;
  daysInMonth: number;
  currentHour: number;
  hourlySync: { running: boolean; lastSuccessAt: string | null };
  results: AgencyResults;
  staff: Array<{ id: string; label: string }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => readParam(searchParams, "q"));
  const [health, setHealth] = useState<HealthFilter>(() => {
    const v = readParam(searchParams, "health");
    return HEALTH_ORDER.includes(v as AlertSeverity) ? (v as HealthFilter) : "";
  });
  const [owner, setOwner] = useState(() => readParam(searchParams, "owner"));
  const [staleOnly, setStaleOnly] = useState(
    () => readParam(searchParams, "stale") === "1",
  );
  const [sort, setSort] = useState<SortState>(() => {
    const key = readParam(searchParams, "sort") as SortKey;
    return {
      key: SORT_KEYS.includes(key) ? key : "health",
      dir: readParam(searchParams, "dir") === "desc" ? "desc" : "asc",
    };
  });
  const [open, setOpen] = useState<string | null>(() =>
    readParam(searchParams, "open") || null,
  );

  /** Filtreler URL'de — "Halis'in kritik markaları" linki paylaşılabilsin. */
  function syncUrl(next: Record<string, string>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  const summary = useMemo(() => {
    const healthCounts: Record<AlertSeverity, number> = {
      critical: 0,
      warn: 0,
      unknown: 0,
      ok: 0,
    };
    let stale = 0;
    let tokenIssues = 0;
    let noPlan = 0;
    const money = new Map<string, { planned: number; spent: number }>();
    for (const r of rows) {
      healthCounts[r.health ?? "unknown"] += 1;
      if (r.syncStale) stale += 1;
      if (r.tokens.meta !== "ok" && r.tokens.meta !== "none") tokenIssues += 1;
      else if (r.tokens.google !== "ok" && r.tokens.google !== "none")
        tokenIssues += 1;
      if (r.planned == null) noPlan += 1;
      const m = money.get(r.currency) ?? { planned: 0, spent: 0 };
      m.planned += r.planned ?? 0;
      m.spent += r.spent;
      money.set(r.currency, m);
    }
    // En çok markanın kullandığı para birimi özet kartında gösterilir.
    const main = [...money.entries()].sort(
      (a, b) =>
        rows.filter((r) => r.currency === b[0]).length -
        rows.filter((r) => r.currency === a[0]).length,
    )[0];
    return {
      healthCounts,
      stale,
      tokenIssues,
      noPlan,
      currency: main?.[0] ?? "TRY",
      planned: main?.[1].planned ?? 0,
      spent: main?.[1].spent ?? 0,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = query.toLocaleLowerCase("tr");
    const filtered = rows.filter((r) => {
      if (
        q &&
        !r.name.toLocaleLowerCase("tr").includes(q) &&
        !r.slug.includes(q)
      )
        return false;
      if (health && (r.health ?? "unknown") !== health) return false;
      if (owner === "none" && r.owner) return false;
      if (owner && owner !== "none" && r.owner?.id !== owner) return false;
      if (staleOnly && !r.syncStale) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return filtered.sort(
      (a, b) =>
        sign * compare(a, b, sort.key) || a.name.localeCompare(b.name, "tr"),
    );
  }, [rows, query, health, owner, staleOnly, sort]);

  function toggleSort(key: SortKey) {
    const dir =
      sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : "asc";
    setSort({ key, dir });
    syncUrl({ sort: key, dir: dir === "desc" ? "desc" : "" });
  }

  function pickHealth(next: HealthFilter) {
    setHealth(next);
    syncUrl({ health: next });
  }

  function toggleOpen(slug: string) {
    const next = open === slug ? null : slug;
    setOpen(next);
    syncUrl({ open: next ?? "" });
  }

  /** Grafikten marka seçimi: filtre gizliyorsa temizle, satırı aç ve kaydır. */
  function revealRow(slug: string) {
    if (!visibleRows.some((r) => r.slug === slug)) {
      setQuery("");
      setHealth("");
      setOwner("");
      setStaleOnly(false);
      syncUrl({ q: "", health: "", owner: "", stale: "" });
    }
    setOpen(slug);
    syncUrl({ open: slug });
    requestAnimationFrame(() =>
      document
        .getElementById(`brand-row-${slug}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  const [chartsOpen, setChartsOpen] = useState(true);

  const anyFilter = Boolean(query || health || owner || staleOnly);
  const totalPct =
    summary.planned > 0 ? Math.round((summary.spent / summary.planned) * 100) : null;

  return (
    <div className="space-y-4">
      <SummaryStrip
        rows={rows.length}
        summary={summary}
        totalPct={totalPct}
        monthLabel={monthLabel}
        health={health}
        onHealth={pickHealth}
        onStale={() => {
          setStaleOnly(true);
          syncUrl({ stale: "1" });
        }}
      />

      <div>
        <button
          type="button"
          aria-expanded={chartsOpen}
          onClick={() => setChartsOpen(!chartsOpen)}
          className={btnGhost}
        >
          <ChevronDown
            className={`size-4 transition ${chartsOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
          {chartsOpen ? "Grafikleri gizle" : "Grafikleri göster"}
        </button>
        {chartsOpen ? (
          <div className="mt-2 grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <AgencyResultsCard
              results={results}
              currency={summary.currency}
              monthLabel={monthLabel}
              today={today}
              onPick={revealRow}
            />
            <AgencyTodayCard
              rows={rows}
              currency={summary.currency}
              currentHour={currentHour}
              hourlySync={hourlySync}
              onPick={revealRow}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <span className="sr-only">Marka ara</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              syncUrl({ q: e.target.value.trim() });
            }}
            placeholder="Marka ara…"
            className={`${fieldClass} w-full pl-10`}
          />
        </label>
        <select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value);
            syncUrl({ owner: e.target.value });
          }}
          aria-label="Sorumlu filtresi"
          className={fieldClass}
        >
          <option value="">Sorumlu: herkes</option>
          <option value="none">Atanmamış</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={staleOnly}
          onClick={() => {
            setStaleOnly(!staleOnly);
            syncUrl({ stale: staleOnly ? "" : "1" });
          }}
          className={chipClass(staleOnly)}
        >
          Senkronu 24 saati geçenler
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={health === ""}
          onClick={() => pickHealth("")}
          className={chipClass(health === "")}
        >
          Tümü
          <span className="tabular-nums opacity-70">{rows.length}</span>
        </button>
        {HEALTH_ORDER.map((h) => {
          const meta = HEALTH_META[h];
          return (
            <button
              key={h}
              type="button"
              aria-pressed={health === h}
              onClick={() => pickHealth(h)}
              className={chipClass(health === h)}
            >
              <meta.Icon
                className="size-4"
                style={{ color: health === h ? undefined : meta.fill }}
                aria-hidden
              />
              {meta.label}
              <span className="tabular-nums opacity-70">
                {summary.healthCounts[h]}
              </span>
            </button>
          );
        })}
        {anyFilter ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setHealth("");
              setOwner("");
              setStaleOnly(false);
              syncUrl({ q: "", health: "", owner: "", stale: "" });
            }}
            className={btnGhost}
          >
            Filtreleri temizle
          </button>
        ) : null}
        <span className="ml-auto text-sm text-zinc-500">
          {visibleRows.length} / {rows.length} marka · başlığa tıklayarak sırala
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 px-2 pb-2">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600 [&_th]:border-b [&_th]:border-zinc-200">
            <tr>
              <SortHeader label="Marka" k="name" sort={sort} onSort={toggleSort} />
              <SortHeader label="Durum" k="health" sort={sort} onSort={toggleSort} />
              <SortHeader
                label={`Bütçe & tempo · ${monthLabel}`}
                k="budget"
                sort={sort}
                onSort={toggleSort}
                className="w-[13.5rem]"
              />
              <SortHeader
                label="Bugün"
                k="today"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Senkron · token"
                k="sync"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader label="Sorumlu" k="owner" sort={sort} onSort={toggleSort} />
              <th scope="col" className="w-14 py-3 pr-3 pl-1">
                <span className="sr-only">Ayrıntı</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-sm text-zinc-500"
                >
                  Filtreye uyan marka yok.
                </td>
              </tr>
            ) : (
              visibleRows.map((r) => (
                <Fragment key={r.slug}>
                  <Row
                    row={r}
                    open={open === r.slug}
                    dimmed={open !== null && open !== r.slug}
                    onToggle={() => toggleOpen(r.slug)}
                    currentHour={currentHour}
                  />
                  {open === r.slug ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="rounded-b-2xl bg-white p-[2px] pt-0 shadow-[inset_2px_0_0_#141111,inset_-2px_0_0_#141111,inset_0_-2px_0_#141111]"
                      >
                        <div className="overflow-hidden rounded-b-[14px] border-t border-zinc-200">
                          <AgencyBrandRowDetail
                            row={r}
                            today={today}
                            daysInMonth={daysInMonth}
                            monthLabel={monthLabel}
                            currentHour={currentHour}
                          />
                          <button
                            type="button"
                            onClick={() => toggleOpen(r.slug)}
                            className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-zinc-100 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-50 hover:text-[#141111]"
                          >
                            <ChevronUp className="size-4" aria-hidden />
                            {r.name} ayrıntısını kapat
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryStrip({
  rows,
  summary,
  totalPct,
  monthLabel,
  health,
  onHealth,
  onStale,
}: {
  rows: number;
  summary: {
    healthCounts: Record<AlertSeverity, number>;
    stale: number;
    tokenIssues: number;
    noPlan: number;
    currency: string;
    planned: number;
    spent: number;
  };
  totalPct: number | null;
  monthLabel: string;
  health: HealthFilter;
  onHealth: (h: HealthFilter) => void;
  onStale: () => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="flex items-baseline justify-between gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Marka sağlığı
          <span className="font-normal tracking-normal normal-case">
            çubuğa tıklayarak filtrele
          </span>
        </p>
        <div
          className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
          role="img"
          aria-label={HEALTH_ORDER.map(
            (h) => `${HEALTH_META[h].label} ${summary.healthCounts[h]}`,
          ).join(", ")}
        >
          {HEALTH_ORDER.map((h) =>
            summary.healthCounts[h] > 0 ? (
              <button
                key={h}
                type="button"
                title={`${HEALTH_META[h].label}: ${summary.healthCounts[h]} marka`}
                onClick={() => onHealth(health === h ? "" : h)}
                aria-label={`${HEALTH_META[h].label} markaları filtrele`}
                className="h-full cursor-pointer transition hover:opacity-75"
                style={{
                  width: `${(summary.healthCounts[h] / Math.max(rows, 1)) * 100}%`,
                  background: HEALTH_META[h].fill,
                }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {HEALTH_ORDER.map((h) => (
            <li key={h} className="inline-flex items-center gap-1.5 text-zinc-700">
              <span
                className="size-2.5 rounded-full"
                style={{ background: HEALTH_META[h].fill }}
                aria-hidden
              />
              {HEALTH_META[h].label}
              <span className="font-semibold text-[#141111] tabular-nums">
                {summary.healthCounts[h]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Toplam bütçe · {monthLabel}
        </p>
        <p className="mt-2 text-2xl font-semibold text-[#141111]">
          {compactTry(summary.spent, summary.currency)}
        </p>
        <p className="text-sm text-zinc-500">
          plan {compactTry(summary.planned, summary.currency)}
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-[#141111]"
            style={{ width: `${Math.min(totalPct ?? 0, 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {totalPct != null ? `Planın %${totalPct}'i harcandı` : "Plan girilmemiş"}
          {summary.noPlan > 0 ? ` · ${summary.noPlan} markada plan yok` : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={onStale}
        className="group cursor-pointer rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-[#141111] hover:shadow-sm"
      >
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Senkron gecikmiş
        </p>
        <p
          className={`mt-2 text-2xl font-semibold ${summary.stale > 0 ? "text-rose-700" : "text-[#141111]"}`}
        >
          {summary.stale}
          <span className="ml-1 text-sm font-normal text-zinc-500">/ {rows}</span>
        </p>
        <p className="mt-1.5 text-xs font-semibold text-[#141111] underline-offset-2 group-hover:underline">
          24 saatten eski · tıkla, filtrele →
        </p>
      </button>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Token / erişim sorunu
        </p>
        <p
          className={`mt-2 text-2xl font-semibold ${summary.tokenIssues > 0 ? "text-rose-700" : "text-[#141111]"}`}
        >
          {summary.tokenIssues}
        </p>
        <p className="mt-1.5 text-xs text-zinc-500">
          Meta veya Google çekimi yetki hatası veriyor
        </p>
      </div>
    </div>
  );
}

/** Bütçe çubuğu: dolgu = harcanan (tempo tonunda), çizgi = bugüne kadar beklenen. */
/** Markanın kullandığı kanallar — kapalı/eşleşmesiz ve harcamasız kanal gizlenir. */
function budgetChannels(r: BrandTableRow) {
  return (["meta", "google"] as const)
    .filter((p) => r.todayByProvider[p].state !== "n/a" || r.channels[p].spent > 0)
    .map((p) => ({
      key: p,
      name: p === "meta" ? "Meta" : "Google",
      color: p === "meta" ? META_COLOR : GOOGLE_COLOR,
      ...r.channels[p],
    }));
}

function BudgetMeter({ row: r }: { row: BrandTableRow }) {
  const pct = budgetPct(r);
  const channels = budgetChannels(r);
  const channelLines = (
    <ul className="mt-2 space-y-1.5">
      {channels.map((c) => {
        const cPct = c.planned ? Math.round((c.spent / c.planned) * 100) : null;
        return (
          <li
            key={c.key}
            className="flex items-center gap-1.5 text-xs whitespace-nowrap tabular-nums"
          >
            <PlatformBadge platform={c.key} />
            <span className="font-semibold text-[#141111]">{compactTry(c.spent, r.currency)}</span>
            {c.planned ? (
              <span className="truncate text-zinc-400">
                / {compactTry(c.planned, r.currency)} · %{cPct}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  if (r.planned == null) {
    return (
      <div>
        <p className="text-sm font-medium text-[#141111] tabular-nums">
          {formatTry(r.spent, r.currency)}
        </p>
        <p className="text-xs text-zinc-400">Plan yok</p>
        {channels.length > 1 ? channelLines : null}
      </div>
    );
  }
  const expectedPct =
    r.expectedToDate != null ? (r.expectedToDate / r.planned) * 100 : null;
  // Toplam plana göre kanal dilimleri — çubuk %100'de kesilir.
  const planned = r.planned;
  const segments = channels.reduce<Array<(typeof channels)[number] & { w: number }>>(
    (acc, c) => {
      const used = acc.reduce((t, x) => t + x.w, 0);
      return [...acc, { ...c, w: Math.min((c.spent / planned) * 100, 100 - used) }];
    },
    [],
  );
  return (
    <div
      title={`Harcanan ${formatTry(r.spent, r.currency)} / plan ${formatTry(r.planned, r.currency)}${
        r.expectedToDate != null
          ? ` · bugüne kadar beklenen ${formatTry(r.expectedToDate, r.currency)}`
          : ""
      }\n${channels
        .map(
          (c) =>
            `${c.name}: ${formatTry(c.spent, r.currency)}${c.planned ? ` / ${formatTry(c.planned, r.currency)}` : ""}`,
        )
        .join("\n")}`}
    >
      <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
        <span className="text-sm font-semibold text-[#141111] tabular-nums">
          {compactTry(r.spent, r.currency)}
        </span>
        <span className="text-xs text-zinc-500 tabular-nums">
          / {compactTry(r.planned, r.currency)} · %{Math.round(pct ?? 0)}
        </span>
      </div>
      <div className="relative mt-1.5 flex h-2 w-full gap-[2px] rounded-full bg-zinc-100">
        {segments
          .filter((sg) => sg.w > 0)
          .map((sg, i, arr) => (
            <div
              key={sg.key}
              className={`h-full ${i === 0 ? "rounded-l-full" : ""} ${i === arr.length - 1 ? "rounded-r-full" : ""}`}
              style={{ width: `${sg.w}%`, background: sg.color }}
            />
          ))}
        {expectedPct != null && expectedPct > 0 && expectedPct < 100 ? (
          <span
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-[#141111]"
            style={{ left: `calc(${expectedPct}% - 1px)` }}
            aria-hidden
          />
        ) : null}
      </div>
      {channelLines}
    </div>
  );
}

/** Bugünkü harcama (saatlik senkron) + saat saat mini çubuk + ödeme durumu. */
function TodayCell({
  row: r,
  currentHour,
}: {
  row: BrandTableRow;
  currentHour: number;
}) {
  const issue = paymentIssue(r);
  const hours = r.hourly.slice(0, currentHour + 1);
  const max = Math.max(...hours.map((h) => h.meta + h.google), 0);
  const w = 3;
  const gap = 1;
  const h = 20;

  return (
    <div className="space-y-1">
      {issue ? (
        <p
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            issue.critical ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-900"
          }`}
          title={`${issue.provider}: ${issue.label}`}
        >
          <AlertTriangle className="size-3.5" aria-hidden />
          {issue.provider}: {issue.label}
        </p>
      ) : null}
      {!r.hourlyFetched && r.todaySpend === 0 ? (
        <p className="text-xs text-zinc-500">
          {missingProviders(r).length
            ? `${missingProviders(r).join(" + ")} verisi alınamadı`
            : "Saatlik veri yok"}
        </p>
      ) : r.todaySpend === 0 ? (
        <p className="text-sm font-semibold text-rose-700">
          ₺0 · harcama yok
          {r.lastSpendDate && r.lastSpendDate !== "" ? (
            <span className="block text-xs font-normal text-zinc-500">
              son: {r.lastSpendDate.slice(8, 10)}.{r.lastSpendDate.slice(5, 7)}
            </span>
          ) : null}
        </p>
      ) : (
        <div className="flex items-end gap-2">
          <span className="text-sm font-semibold text-[#141111] tabular-nums">
            {compactTry(r.todaySpend, r.currency)}
          </span>
          {max > 0 ? (
            <svg
              width={hours.length * (w + gap)}
              height={h}
              role="img"
              aria-label={`Bugün saat saat harcama, ${hours.length} saat`}
            >
              {hours.map((p) => {
                const v = p.meta + p.google;
                const bh = Math.max(v > 0 ? 2 : 1, (v / max) * h);
                return (
                  <rect
                    key={p.hour}
                    x={p.hour * (w + gap)}
                    y={h - bh}
                    width={w}
                    height={bh}
                    rx={1}
                    fill={v > 0 ? "#78716c" : "#e7e5e4"}
                  >
                    <title>{`${String(p.hour).padStart(2, "0")}:00 · ${formatTry(v, r.currency)}`}</title>
                  </rect>
                );
              })}
            </svg>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Row({
  row: r,
  open,
  dimmed,
  onToggle,
  currentHour,
}: {
  row: BrandTableRow;
  open: boolean;
  /** Başka bir satır açıkken geri plana çekilir. */
  dimmed: boolean;
  onToggle: () => void;
  currentHour: number;
}) {
  const cover = resolveBrandCover({
    slug: r.slug,
    name: r.name,
    coverUrl: r.coverUrl,
  });
  const pace = PACE_STATUS_META[r.paceStatus];
  // Ödeme/hesap sorunu "Bugün" sütununda gösteriliyor — burada tekrarlanmasın.
  const [first, ...rest] = r.reasons.filter((x) => !x.text.includes("ödeme/hesap"));

  return (
    <tr
      id={`brand-row-${r.slug}`}
      onClick={onToggle}
      title={open ? "Ayrıntıyı kapatmak için tıklayın" : "Grafik ve log ayrıntısı için tıklayın"}
      className={`group cursor-pointer scroll-mt-20 align-middle text-zinc-700 [&>td]:transition-[filter,opacity,box-shadow] [&>td]:duration-300 ${
        // Her satır ayrı kart: üstte şeffaf boşluk, çerçeve inset gölgeyle.
        "[&>td]:border-t-[10px] [&>td]:border-transparent [&>td]:bg-white [&>td]:bg-clip-padding [&>td:first-child]:rounded-tl-[24px] [&>td:last-child]:rounded-tr-[24px] "
      }${
        open
          ? "[&>td]:shadow-[inset_0_2px_0_#141111] [&>td:first-child]:shadow-[inset_2px_0_0_#141111,inset_0_2px_0_#141111] [&>td:last-child]:shadow-[inset_-2px_0_0_#141111,inset_0_2px_0_#141111]"
          : `[&>td:first-child]:rounded-bl-2xl [&>td:last-child]:rounded-br-2xl [&>td]:shadow-[inset_0_1px_0_#d4d4d8,inset_0_-1px_0_#d4d4d8] [&>td:first-child]:shadow-[inset_1px_0_0_#d4d4d8,inset_0_1px_0_#d4d4d8,inset_0_-1px_0_#d4d4d8] [&>td:last-child]:shadow-[inset_-1px_0_0_#d4d4d8,inset_0_1px_0_#d4d4d8,inset_0_-1px_0_#d4d4d8] hover:[&>td]:shadow-[inset_0_2px_0_#141111,inset_0_-2px_0_#141111] hover:[&>td:first-child]:shadow-[inset_2px_0_0_#141111,inset_0_2px_0_#141111,inset_0_-2px_0_#141111] hover:[&>td:last-child]:shadow-[inset_-2px_0_0_#141111,inset_0_2px_0_#141111,inset_0_-2px_0_#141111] ${
              dimmed
                ? "[&>td]:opacity-35 [&>td]:blur-[2px] [&>td]:grayscale hover:[&>td]:opacity-100 hover:[&>td]:blur-none hover:[&>td]:grayscale-0"
                : ""
            }`
      }`}
    >
      <td className="px-3 py-3">
        <Link
          href={`/brands/${encodeURIComponent(r.slug)}`}
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-[11rem] items-center gap-3 font-semibold text-[#141111] hover:text-[#e91825]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.src}
                alt=""
                loading="lazy"
                className={
                  cover.fit === "cover"
                    ? "h-full w-full object-cover"
                    : "h-full w-full object-contain p-1"
                }
              />
            ) : (
              <span className="text-xs font-semibold text-zinc-400">
                {brandInitials(r.name)}
              </span>
            )}
          </span>
          <span className="min-w-0">
            {r.name}
            {open ? (
              <span className="mt-1 flex w-fit items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#e91825] ring-1 ring-[#e91825]/25">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#e91825] opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[#e91825]" />
                </span>
                Ayrıntı açık
              </span>
            ) : null}
          </span>
        </Link>
      </td>
      <td className="px-3 py-3">
        <div className="min-w-[13rem] space-y-1">
          {r.health ? (
            <StatusBadge status={r.health} />
          ) : (
            <span className="text-xs text-zinc-400">Devre dışı</span>
          )}
          {first ? (
            <p
              className={`line-clamp-2 text-xs leading-snug ${TONE_TEXT[first.tone]}`}
              title={r.reasons.map((x) => x.text).join("\n")}
            >
              {first.text}
              {rest.length ? (
                <span className="ml-1 font-semibold text-zinc-500">
                  +{rest.length}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </td>
      <td className="w-[13.5rem] min-w-[13.5rem] px-3 py-3">
        <BudgetMeter row={r} />
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ${TONE_CHIP[pace.tone]}`}
            title={pace.hint}
          >
            {pace.label}
          </span>
          {r.projectedPct != null && r.paceStatus !== "none" ? (
            <span className="text-xs text-zinc-500">ay sonu ~%{r.projectedPct}</span>
          ) : null}
        </p>
      </td>
      <td className="px-3 py-3">
        <TodayCell row={r} currentHour={currentHour} />
      </td>
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        <p
          className={`inline-flex items-center gap-1.5 ${r.syncStale ? "font-semibold text-rose-700" : "text-zinc-700"}`}
        >
          <span
            className={`size-2 rounded-full ${r.syncStale ? "bg-rose-600" : "bg-emerald-600"}`}
            aria-hidden
          />
          {r.lastSyncAt ? formatDateTime(r.lastSyncAt) : "Hiç senkron yok"}
        </p>
        <p className="mt-1 space-x-2">
          {(["meta", "google"] as const).map((p) => {
            const t = TOKEN_META[r.tokens[p]];
            return (
              <span key={p}>
                <span className="text-zinc-400">
                  {p === "meta" ? "Meta" : "Google"}
                </span>{" "}
                <span className={`font-medium ${TONE_TEXT[t.tone]}`}>{t.label}</span>
              </span>
            );
          })}
        </p>
      </td>
      <td className="px-3 py-3 text-xs whitespace-nowrap">
        {r.owner ? (
          <span className="font-medium text-[#141111]">{r.owner.label}</span>
        ) : (
          <span className="text-zinc-400">Atanmadı</span>
        )}
      </td>
      <td className="py-3 pr-3 pl-1 text-right">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Ayrıntıyı kapat" : "Ayrıntıyı aç"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition ${
            open
              ? "border-[#e91825] bg-[#e91825] text-white shadow-[0_6px_16px_-4px_rgba(233,24,37,0.55)]"
              : "border-zinc-300 bg-white text-[#141111] group-hover:border-[#141111] group-hover:bg-[#141111] group-hover:text-white"
          }`}
        >
          <ChevronDown
            className={`size-4 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </td>
    </tr>
  );
}
