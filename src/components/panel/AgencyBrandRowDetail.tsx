"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Filter,
  RefreshCw,
  ScrollText,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  CumulativeSpendChart,
  NoSpendState,
  ServiceDurationChart,
  SyncActivityChart,
} from "@/components/panel/AgencyBrandCharts";
import AgencyBrandPerformance from "@/components/panel/AgencyBrandPerformance";
import SyncButton from "@/components/panel/SyncButton";
import { StatusBadge } from "@/components/panel/StatusBadge";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  chipClass,
  fieldClass,
} from "@/components/panel/ds/buttons";
import type { AuditRow } from "@/components/panel/AuditLogTable";
import { auditActionLabel } from "@/components/panel/AuditLogTable";
import type { BrandTableRow } from "@/lib/panel/brand-table";
import { PACE_STATUS_META, type PaceTone } from "@/lib/panel/budget-pacing";
import { formatDateTime, formatTry } from "@/lib/panel/format";

import { GOOGLE_COLOR, META_COLOR } from "@/components/panel/ds/chart-theme";

type ErrorClass = "token" | "permission" | "setup" | "rate" | "other";

type LogJob = {
  key: string;
  provider: "meta" | "google";
  api: string;
  call: string;
  status: "pending" | "running" | "success" | "error";
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  error: string | null;
  errorClass: ErrorClass | null;
};

type LogRun = {
  id: string;
  key: string;
  provider: "meta" | "google";
  api: string;
  call: string;
  status: "success" | "error";
  error: string | null;
  errorClass: ErrorClass | null;
  startedAt: string | null;
  finishedAt: string;
  durationMs: number | null;
  trigger: string;
  actorEmail: string | null;
  attempts: number;
};

type LogAlert = {
  id: string;
  type: string;
  severity: "ok" | "warn" | "critical" | "unknown";
  message: string | null;
  updatedAt: string;
};

type LogPayload = {
  days: number;
  since: string;
  jobs: LogJob[];
  runs: LogRun[];
  truncated: boolean;
  alerts: LogAlert[];
  audit: AuditRow[];
};

const ERROR_CLASS_META: Record<ErrorClass, { label: string; hint: string }> = {
  token: {
    label: "Token",
    hint: "Ajans API token'ı geçersiz ya da eksik — Ayarlar'dan yenilenmeli.",
  },
  permission: {
    label: "Erişim",
    hint: "Hesap system user'a atanmamış veya izin verilmemiş.",
  },
  setup: {
    label: "Kurulum",
    hint: "Eşleşme eksik ya da API projede etkin değil — marka ayarlarını kontrol edin.",
  },
  rate: {
    label: "API limiti",
    hint: "Geçici kota aşımı — bir sonraki çekimde genelde kendiliğinden düzelir.",
  },
  other: {
    label: "Diğer",
    hint: "Beklenmeyen hata — mesajın tamamını inceleyin.",
  },
};

const TRIGGER_LABEL: Record<string, string> = {
  manual: "Manuel",
  retry: "Yeniden dene",
  cron: "Otomatik",
  backfill: "Backfill",
};

const TONE_DOT: Record<PaceTone, string> = {
  ok: "bg-emerald-600",
  warn: "bg-amber-500",
  critical: "bg-rose-600",
  muted: "bg-zinc-400",
};

const LOG_DAY_OPTIONS = [7, 14, 30] as const;
/** Liste ilk yüklemede bu kadar kayıt gösterir; "Daha fazla" ile artar. */
const LOG_PAGE = 30;

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace(".", ",")} sn`;
  return `${Math.floor(s / 60)} dk ${Math.round(s % 60)} sn`;
}

function compactNumber(v: number): string {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    compactDisplay: "long",
    maximumFractionDigits: 1,
  }).format(v);
}

function ymdIstanbul(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}

function timeIstanbul(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function dayLabel(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

function lastNDays(today: string, n: number): string[] {
  const base = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  return Array.from({ length: n }, (_, i) =>
    new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

type DetailTab = "overview" | "performance" | "logs" | "alerts";

export default function AgencyBrandRowDetail({
  row,
  today,
  daysInMonth,
  monthLabel,
  currentHour,
}: {
  row: BrandTableRow;
  today: string;
  daysInMonth: number;
  monthLabel: string;
  currentHour: number;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [days, setDays] = useState<number>(14);
  const [state, setState] = useState<{
    days: number;
    data: LogPayload | null;
    error: string | null;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/panel/tenants/${encodeURIComponent(row.slug)}/logs?days=${days}`,
      { signal: ctrl.signal, cache: "no-store" },
    )
      .then(async (res) => {
        const json = (await res.json()) as LogPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        setState({ days, data: json, error: null });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({
          days,
          data: null,
          error: err instanceof Error ? err.message : "Yüklenemedi",
        });
      });
    return () => ctrl.abort();
  }, [row.slug, days, reloadKey]);

  const loading = !state || state.days !== days;
  const data = state?.data ?? null;
  const logErrors = data?.runs.filter((r) => r.status === "error").length ?? 0;

  const tabs: Array<{
    id: DetailTab;
    label: string;
    Icon: typeof BarChart3;
    badge?: number;
    badgeTone?: "error" | "neutral";
  }> = [
    { id: "overview", label: "Genel bakış", Icon: Wallet },
    { id: "performance", label: "Performans", Icon: BarChart3 },
    {
      id: "logs",
      label: "Senkron logu",
      Icon: ScrollText,
      badge: data ? logErrors : undefined,
      badgeTone: logErrors > 0 ? "error" : "neutral",
    },
    {
      id: "alerts",
      label: "Uyarılar & işlemler",
      Icon: BellRing,
      badge: data?.alerts.length,
      badgeTone: data?.alerts.length ? "error" : "neutral",
    },
  ];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label={`${row.name} ayrıntı sekmeleri`}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={chipClass(tab === t.id)}
            >
              <t.Icon className="size-4" aria-hidden />
              {t.label}
              {t.badge != null ? (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-xs font-bold tabular-nums ${
                    t.badgeTone === "error"
                      ? "bg-[#e91825] text-white"
                      : tab === t.id
                        ? "bg-white/20"
                        : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/brands/${encodeURIComponent(row.slug)}`}
            className={btnPrimary}
          >
            Marka detayı
            <ExternalLink className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <TodayPanel row={row} currentHour={currentHour} />
            <ReasonsPanel row={row} />
          </div>
          <MonthPanel
            row={row}
            today={today}
            daysInMonth={daysInMonth}
            monthLabel={monthLabel}
          />
        </div>
      ) : null}

      {tab === "performance" ? <AgencyBrandPerformance slug={row.slug} /> : null}

      {tab === "logs" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SyncButton provider="meta" tenantSlug={row.slug} appearance="meta" />
              <SyncButton provider="google" tenantSlug={row.slug} appearance="google" />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Log aralığı">
              {LOG_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => setDays(d)}
                  className={chipClass(days === d)}
                >
                  Son {d} gün
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className={btnSecondary}
              >
                <RefreshCw className="size-4" aria-hidden />
                Yenile
              </button>
            </div>
          </div>

          {state?.error && !loading ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Log yüklenemedi: {state.error}
            </p>
          ) : loading || !data ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <SyncActivityChart
                  runs={data.runs}
                  days={lastNDays(today, Math.min(data.days, 30))}
                />
                <ServiceDurationChart runs={data.runs} />
              </div>
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
                <LogView data={data} today={today} />
              </section>
            </>
          )}
        </div>
      ) : null}

      {tab === "alerts" ? (
        !data ? (
          <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" aria-busy="true" />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
              <h4 className="text-base font-semibold text-[#141111]">
                Açık uyarılar
              </h4>
              {data.alerts.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Açık uyarı yok.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.alerts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5"
                    >
                      <StatusBadge status={a.severity} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-800">{a.message || a.type}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          <span className="font-mono">{a.type}</span> ·{" "}
                          {formatDateTime(a.updatedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-base font-semibold text-[#141111]">
                  Son işlemler
                </h4>
                <Link
                  href={`/audit?tenant=${encodeURIComponent(row.slug)}`}
                  className={btnSecondary}
                >
                  Tümünü gör →
                </Link>
              </div>
              {data.audit.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Kayıt yok.</p>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-100">
                  {data.audit.slice(0, 10).map((a) => (
                    <li key={a.id} className="py-2.5">
                      <p className="text-sm text-zinc-800">
                        <span className="font-semibold text-[#141111]">
                          {auditActionLabel(a.action)}
                        </span>{" "}
                        · {a.summary}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.actor} · {formatDateTime(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )
      ) : null}
    </div>
  );
}

const TONE_PILL: Record<PaceTone, string> = {
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  critical: "bg-rose-50 text-rose-800 ring-rose-200",
  muted: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

/** Bu ay: tek özet satırı + tek grafik (Günlük / Kümülatif geçişli). */
function MonthPanel({
  row,
  today,
  daysInMonth,
  monthLabel,
}: {
  row: BrandTableRow;
  today: string;
  daysInMonth: number;
  monthLabel: string;
}) {
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");
  const dailyPlan = row.planned ? row.planned / daysInMonth : null;
  const chartData = row.daily.map((d) => ({
    label: d.date === today ? "Bugün" : dayLabel(d.date),
    date: d.date,
    meta: Math.round(d.meta),
    google: Math.round(d.google),
  }));
  const pace = PACE_STATUS_META[row.paceStatus];
  const money = (v: number | null) =>
    v == null ? "—" : formatTry(v, row.currency);
  const pct =
    row.planned && row.planned > 0
      ? Math.round((row.spent / row.planned) * 100)
      : null;
  const noSpend = chartData.every((d) => d.meta + d.google === 0);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-base font-semibold text-[#141111]">Bu ay · {monthLabel}</h4>
        <div className="flex gap-2" role="group" aria-label="Grafik türü">
          <button
            type="button"
            aria-pressed={mode === "daily"}
            onClick={() => setMode("daily")}
            className={chipClass(mode === "daily")}
          >
            Günlük
          </button>
          <button
            type="button"
            aria-pressed={mode === "cumulative"}
            onClick={() => setMode("cumulative")}
            className={chipClass(mode === "cumulative")}
          >
            Kümülatif
          </button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          label="Harcanan"
          value={money(row.spent)}
          sub={`Meta ${money(row.channels.meta.spent)} · Google ${money(row.channels.google.spent)}`}
        />
        <Figure
          label="Plan"
          value={row.planned != null ? money(row.planned) : "Plan yok"}
          sub={pct != null ? `%${pct} kullanıldı` : "Bütçe planı girilmemiş"}
        />
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <dt className="text-xs font-medium text-zinc-500">Tempo</dt>
          <dd className="mt-1">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ${TONE_PILL[pace.tone]}`}
            >
              {pace.label}
            </span>
          </dd>
          <dd className="mt-1 text-xs text-zinc-500">{pace.hint}</dd>
        </div>
        <Figure
          label="Ay sonu tahmini"
          value={money(row.projected)}
          sub={
            row.recommendedDaily != null
              ? `plana uymak için ${money(row.recommendedDaily)}/gün`
              : row.avgDaily != null
                ? `günlük ortalama ${money(row.avgDaily)}`
                : undefined
          }
        />
      </dl>

      {noSpend ? (
        <NoSpendState row={row} />
      ) : mode === "cumulative" ? (
        <div className="mt-4">
          <CumulativeSpendChart
            row={row}
            today={today}
            daysInMonth={daysInMonth}
            monthLabel={monthLabel}
            bare
          />
        </div>
      ) : (
        <div className="mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-700">
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: META_COLOR }} />
              Meta
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: GOOGLE_COLOR }} />
              Google Ads
            </li>
            {dailyPlan ? (
              <li className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#141111]" aria-hidden />
                Günlük plan {formatTry(dailyPlan, row.currency)}
              </li>
            ) : null}
          </ul>
          <div className="mt-2 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid stroke="#f0eeeb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#78716c", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tick={{ fill: "#78716c", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={compactNumber}
                />
                <Tooltip
                  cursor={{ fill: "rgba(20,17,17,0.05)" }}
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e7e5e4",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#141111",
                  }}
                  labelFormatter={(label, payload) => {
                    const date = payload?.[0]?.payload?.date as string | undefined;
                    return date === today ? "Bugün (saatlik veri, kısmi)" : label;
                  }}
                  formatter={(value, name) => [
                    formatTry(Number(value), row.currency),
                    name === "meta" ? "Meta" : "Google Ads",
                  ]}
                />
                {dailyPlan ? (
                  <ReferenceLine
                    y={dailyPlan}
                    stroke="#141111"
                    strokeWidth={1}
                    ifOverflow="extendDomain"
                  />
                ) : null}
                <Bar dataKey="meta" stackId="spend" fill={META_COLOR} maxBarSize={18} stroke="#ffffff" strokeWidth={1} />
                <Bar
                  dataKey="google"
                  stackId="spend"
                  fill={GOOGLE_COLOR}
                  maxBarSize={18}
                  radius={[4, 4, 0, 0]}
                  stroke="#ffffff"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

const ACCOUNT_TONE: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  critical: "bg-rose-600 text-white ring-rose-600",
  unknown: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

/** Bugün: saat saat harcama + Meta/Google hesap-ödeme durumu. */
function TodayPanel({
  row,
  currentHour,
}: {
  row: BrandTableRow;
  currentHour: number;
}) {
  const hours = row.hourly.slice(0, currentHour + 1).map((h) => ({
    label: `${String(h.hour).padStart(2, "0")}:00`,
    meta: Math.round(h.meta),
    google: Math.round(h.google),
  }));
  const hasSpend = row.todaySpend > 0;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-base font-semibold text-[#141111]">Bugün</h4>
        <span className="text-sm text-zinc-500">
          saat {String(currentHour).padStart(2, "0")}:00&apos;a kadar
        </span>
      </div>

      <p
        className={`mt-2 text-3xl font-semibold ${hasSpend || !row.hourlyFetched ? "text-[#141111]" : "text-rose-700"}`}
      >
        {formatTry(row.todaySpend, row.currency)}
        {!hasSpend && row.hourlyFetched ? (
          <span className="ml-2 text-base font-semibold">· harcama yok</span>
        ) : null}
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {(["meta", "google"] as const).map((p) => {
          const a = row.accounts[p];
          return (
            <li
              key={p}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                ACCOUNT_TONE[a?.status ?? "unknown"]
              }`}
              title={a?.detail ?? undefined}
            >
              {p === "meta" ? "Meta" : "Google Ads"}: {a ? a.label : "kontrol edilmedi"}
            </li>
          );
        })}
      </ul>

      {!row.hourlyFetched ? (
        <p className="mt-4 text-sm text-zinc-500">
          Bugün için saatlik veri henüz çekilmedi. Tablonun üstündeki
          &quot;Şimdi güncelle&quot; ile çekebilirsiniz.
        </p>
      ) : hasSpend ? (
        <div className="mt-3 h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hours} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: "#78716c", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <Tooltip
                cursor={{ fill: "rgba(20,17,17,0.05)" }}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e7e5e4",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#141111",
                }}
                formatter={(value, name) => [
                  formatTry(Number(value), row.currency),
                  name === "meta" ? "Meta" : "Google Ads",
                ]}
              />
              <Bar dataKey="meta" stackId="h" fill={META_COLOR} maxBarSize={14} stroke="#fff" strokeWidth={1} />
              <Bar dataKey="google" stackId="h" fill={GOOGLE_COLOR} maxBarSize={14} radius={[3, 3, 0, 0]} stroke="#fff" strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
          Bugün hiç harcama yapılmadı.
          {row.lastSpendDate
            ? ` Son harcama ${row.lastSpendDate.slice(8, 10)}.${row.lastSpendDate.slice(5, 7)}.${row.lastSpendDate.slice(0, 4)}.`
            : ""}{" "}
          Kampanyaların aktifliğini ve ödeme yöntemini kontrol edin.
        </p>
      )}
    </section>
  );
}

function Figure({
  label,
  value,
  sub,
  swatch,
}: {
  label: string;
  value: string;
  sub?: string;
  swatch?: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
      <dt className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {swatch ? (
          <span className="size-2.5 rounded-sm" style={{ background: swatch }} />
        ) : null}
        {label}
      </dt>
      <dd className="mt-1 text-base font-semibold text-[#141111]">{value}</dd>
      {sub ? <dd className="mt-0.5 text-xs text-zinc-500">{sub}</dd> : null}
    </div>
  );
}

function ReasonsPanel({ row }: { row: BrandTableRow }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-[#141111]">Dikkat gerektirenler</h4>
        {row.health ? <StatusBadge status={row.health} /> : null}
      </div>
      {row.reasons.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" aria-hidden />
          Sorun görünmüyor.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {row.reasons.map((r) => (
            <li
              key={r.text}
              className="flex items-start gap-2.5 rounded-xl border border-zinc-100 px-3 py-2.5 text-sm text-zinc-800"
            >
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_DOT[r.tone]}`}
                aria-hidden
              />
              <span>
                <span className="sr-only">
                  {r.tone === "critical" ? "Kritik: " : r.tone === "warn" ? "Uyarı: " : ""}
                </span>
                {r.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LogView({ data, today }: { data: LogPayload; today: string }) {
  const [statusFilter, setStatusFilter] = useState<"" | "error" | "success">(
    "",
  );
  const [serviceFilter, setServiceFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [limit, setLimit] = useState(LOG_PAGE);

  const services = useMemo(() => {
    const map = new Map<string, { key: string; api: string; call: string }>();
    for (const j of data.jobs) map.set(j.key, j);
    for (const r of data.runs) if (!map.has(r.key)) map.set(r.key, r);
    return [...map.values()].sort((a, b) =>
      `${a.api}${a.call}`.localeCompare(`${b.api}${b.call}`, "tr"),
    );
  }, [data]);

  const errorCount = data.runs.filter((r) => r.status === "error").length;
  const successCount = data.runs.length - errorCount;

  const filtered = data.runs.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!serviceFilter || r.key === serviceFilter) &&
      (!triggerFilter || r.trigger === triggerFilter),
  );

  // Gün başlıklarıyla gruplu liste.
  const grouped = useMemo(() => {
    const out: Array<{ day: string; runs: LogRun[] }> = [];
    for (const r of filtered.slice(0, limit)) {
      const day = ymdIstanbul(r.finishedAt);
      const last = out[out.length - 1];
      if (last?.day === day) last.runs.push(r);
      else out.push({ day, runs: [r] });
    }
    return out;
  }, [filtered, limit]);

  return (
    <div className="mt-4 space-y-5">
      <LogHeatmap
        services={services}
        runs={data.runs}
        days={lastNDays(today, Math.min(data.days, 30))}
        onPick={(key) => setServiceFilter(key === serviceFilter ? "" : key)}
        selected={serviceFilter}
      />

      <ServiceStatusGrid jobs={data.jobs} />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={statusFilter === ""}
            onClick={() => setStatusFilter("")}
            className={chipClass(statusFilter === "")}
          >
            Tümü <span className="tabular-nums opacity-70">{data.runs.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === "error"}
            onClick={() => setStatusFilter("error")}
            className={chipClass(statusFilter === "error")}
          >
            <XCircle
              className={`size-4 ${statusFilter === "error" ? "" : "text-rose-600"}`}
              aria-hidden
            />
            Hatalı <span className="tabular-nums opacity-70">{errorCount}</span>
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === "success"}
            onClick={() => setStatusFilter("success")}
            className={chipClass(statusFilter === "success")}
          >
            <CheckCircle2
              className={`size-4 ${statusFilter === "success" ? "" : "text-emerald-600"}`}
              aria-hidden
            />
            Başarılı <span className="tabular-nums opacity-70">{successCount}</span>
          </button>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            aria-label="Servis filtresi"
            className={fieldClass}
          >
            <option value="">Tüm servisler</option>
            {services.map((s) => (
              <option key={s.key} value={s.key}>
                {s.api} · {s.call}
              </option>
            ))}
          </select>
          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            aria-label="Tetikleyen filtresi"
            className={fieldClass}
          >
            <option value="">Tüm tetikleyenler</option>
            {Object.entries(TRIGGER_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {data.truncated ? (
          <p className="mt-2 text-xs text-amber-700">
            Son {data.runs.length} kayıt gösteriliyor — daha kısa aralık seçin.
          </p>
        ) : null}

        {grouped.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
            {data.runs.length === 0
              ? "Bu aralıkta kayıtlı çekim yok. Log, bu sürümle birlikte tutulmaya başlandı."
              : "Filtreye uyan kayıt yok."}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {grouped.map((g) => (
              <div key={g.day}>
                <p className="sticky top-14 z-[1] mb-2 inline-flex rounded-full bg-[#141111] px-3 py-1 text-xs font-semibold text-white">
                  {dayLabel(g.day)}.{g.day.slice(0, 4)}
                  {g.day === today ? " · bugün" : ""}
                </p>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {g.runs.map((r) => (
                    <LogEntry key={r.id} run={r} />
                  ))}
                </ul>
              </div>
            ))}
            {filtered.length > limit ? (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <span className="text-sm text-zinc-500">
                  {limit} / {filtered.length} kayıt gösteriliyor
                </span>
                <button
                  type="button"
                  onClick={() => setLimit((n) => n + LOG_PAGE)}
                  className={btnSecondary}
                >
                  {Math.min(LOG_PAGE, filtered.length - limit)} kayıt daha göster
                </button>
                <button
                  type="button"
                  onClick={() => setLimit(filtered.length)}
                  className={btnGhost}
                >
                  Tümünü göster
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** Servis × gün: o gün hata varsa kırmızı, yalnız başarı varsa yeşil. */
function LogHeatmap({
  services,
  runs,
  days,
  onPick,
  selected,
}: {
  services: Array<{ key: string; api: string; call: string }>;
  runs: LogRun[];
  days: string[];
  onPick: (key: string) => void;
  selected: string;
}) {
  const cells = useMemo(() => {
    const map = new Map<string, { ok: number; err: number; lastError: string | null }>();
    for (const r of runs) {
      const id = `${r.key}|${ymdIstanbul(r.finishedAt)}`;
      const c = map.get(id) ?? { ok: 0, err: 0, lastError: null };
      if (r.status === "error") {
        c.err += 1;
        c.lastError ??= r.error;
      } else c.ok += 1;
      map.set(id, c);
    }
    return map;
  }, [runs]);

  if (services.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#141111]">
          Günlük çekim haritası
          <span className="ml-2 text-xs font-normal text-zinc-500">
            servis adına tıklayarak listeyi filtreleyin
          </span>
        </p>
        <ul className="flex flex-wrap gap-3 text-xs text-zinc-600">
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-emerald-600" /> Başarılı
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-rose-600" /> Hata var
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-zinc-200" /> Çekim yok
          </li>
        </ul>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th className="sr-only">Servis</th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="w-6 px-0 text-center text-[10px] font-normal text-zinc-400"
                >
                  {d.slice(8, 10)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.key}>
                <th scope="row" className="pr-3 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onPick(s.key)}
                    aria-pressed={selected === s.key}
                    className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-left whitespace-nowrap transition ${
                      selected === s.key
                        ? "border-[#141111] bg-[#141111] text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-[#141111] hover:text-[#141111]"
                    }`}
                    title="Log listesini bu servise göre filtrele"
                  >
                    <Filter className="size-3 opacity-60" aria-hidden />
                    <span className="font-semibold">{s.api}</span>{" "}
                    <span className="opacity-70">{s.call}</span>
                  </button>
                </th>
                {days.map((d) => {
                  const c = cells.get(`${s.key}|${d}`);
                  const cls = !c
                    ? "bg-zinc-200"
                    : c.err > 0
                      ? "bg-rose-600"
                      : "bg-emerald-600";
                  const title = !c
                    ? `${dayLabel(d)} · çekim yok`
                    : `${dayLabel(d)} · ${c.ok} başarılı, ${c.err} hatalı${
                        c.lastError ? `\n${c.lastError.slice(0, 200)}` : ""
                      }`;
                  return (
                    <td key={d} className="p-0">
                      <span
                        className={`block size-6 rounded-[4px] ${cls}`}
                        title={title}
                        aria-label={title}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceStatusGrid({ jobs }: { jobs: LogJob[] }) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-[#141111]">Servis durumu</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {jobs.map((j) => {
          const failed = j.status === "error";
          return (
            <li
              key={j.key}
              className={`rounded-xl border px-3 py-2.5 ${
                failed ? "border-rose-200 bg-rose-50/60" : "border-zinc-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-[#141111]">
                  {j.api}
                </p>
                <StatusChip status={j.status} />
              </div>
              <p className="truncate font-mono text-[11px] text-zinc-500">{j.call}</p>
              <p className="mt-1.5 text-xs text-zinc-600">
                Son başarı:{" "}
                <span className="font-medium text-[#141111]">
                  {formatDateTime(j.lastSuccessAt)}
                </span>
              </p>
              {j.lastErrorAt ? (
                <p className="text-xs text-zinc-600">
                  Son hata:{" "}
                  <span className="font-medium text-rose-700">
                    {formatDateTime(j.lastErrorAt)}
                  </span>
                </p>
              ) : null}
              {failed && j.errorClass ? (
                <p className="mt-1 text-xs text-rose-800">
                  <span className="font-semibold">
                    {ERROR_CLASS_META[j.errorClass].label}:
                  </span>{" "}
                  {ERROR_CLASS_META[j.errorClass].hint}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
        <CheckCircle2 className="size-3.5" aria-hidden /> Başarılı
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">
        <XCircle className="size-3.5" aria-hidden /> Hata
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
      <AlertTriangle className="size-3.5" aria-hidden />
      {status === "running" ? "Çalışıyor" : "Bekliyor"}
    </span>
  );
}

function LogEntry({ run: r }: { run: LogRun }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const failed = r.status === "error";
  const errMeta = r.errorClass ? ERROR_CLASS_META[r.errorClass] : null;

  return (
    <li className={failed ? "bg-rose-50/40" : ""}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3 text-left transition hover:bg-zinc-50"
      >
        <span className="w-16 font-mono text-xs text-zinc-500 tabular-nums">
          {timeIstanbul(r.finishedAt)}
        </span>
        <StatusChip status={r.status} />
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-[#141111]">{r.api}</span>{" "}
          <span className="font-mono text-xs text-zinc-500">{r.call}</span>
          {failed && errMeta ? (
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
              {errMeta.label}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-zinc-600 tabular-nums">
          {formatDuration(r.durationMs)}
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
          {TRIGGER_LABEL[r.trigger] ?? r.trigger}
        </span>
        <ChevronDown
          className={`size-4 text-zinc-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-zinc-100 bg-white px-3 py-3 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <LogField label="Başlangıç" value={r.startedAt ? formatDateTime(r.startedAt) + " · " + timeIstanbul(r.startedAt) : "—"} />
            <LogField label="Bitiş" value={`${formatDateTime(r.finishedAt)} · ${timeIstanbul(r.finishedAt)}`} />
            <LogField label="Süre" value={formatDuration(r.durationMs)} />
            <LogField
              label="Deneme"
              value={r.attempts > 1 ? `${r.attempts} (geçici hata sonrası tekrar)` : "1"}
            />
            <LogField label="Tetikleyen" value={TRIGGER_LABEL[r.trigger] ?? r.trigger} />
            <LogField label="Kim" value={r.actorEmail ?? (r.trigger === "cron" ? "Sistem" : "—")} />
            <LogField label="Kanal" value={r.provider === "meta" ? "Meta" : "Google"} />
            <LogField label="Çağrı" value={r.call} mono />
          </dl>
          {failed ? (
            <div className="space-y-2">
              {errMeta ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  <span className="font-semibold">{errMeta.label}:</span> {errMeta.hint}
                </p>
              ) : null}
              <div className="relative">
                <pre className="max-h-64 overflow-auto rounded-xl bg-[#141111] p-3 pr-24 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white">
                  {r.error ?? "Hata mesajı yok"}
                </pre>
                {r.error ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.error ?? "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        /* pano izni yok */
                      }
                    }}
                    className="absolute top-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-[#141111] transition hover:bg-[#e91825] hover:text-white"
                  >
                    <Copy className="size-3.5" aria-hidden />
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function LogField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={`mt-0.5 text-[#141111] ${mono ? "font-mono text-xs break-all" : "text-sm"}`}
      >
        {value}
      </dd>
    </div>
  );
}
