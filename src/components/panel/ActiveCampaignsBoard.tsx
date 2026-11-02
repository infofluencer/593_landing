"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Megaphone, Search, Wallet } from "lucide-react";
import { chipClass, fieldClass } from "@/components/panel/ds/buttons";
import { PlatformBadge } from "@/components/panel/ds/platform-icons";
import { brandInitials, resolveBrandCover } from "@/lib/panel/brand-logos";
import type {
  ActiveCampaign,
  ActiveCampaignBrand,
  ActiveCampaignProvider,
  ActiveCampaignsSnapshot,
} from "@/lib/panel/active-campaigns";
import { formatConv, formatNumber, formatTry } from "@/lib/panel/format";

type ProviderFilter = "" | ActiveCampaignProvider;
type SortKey = "spend7d" | "spendYesterday" | "name";

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_SALES: "Satış",
  OUTCOME_LEADS: "Potansiyel müşteri",
  OUTCOME_TRAFFIC: "Trafik",
  OUTCOME_ENGAGEMENT: "Etkileşim",
  OUTCOME_AWARENESS: "Bilinirlik",
  OUTCOME_APP_PROMOTION: "Uygulama",
  MESSAGES: "Mesaj",
  CONVERSIONS: "Dönüşüm",
  LEAD_GENERATION: "Potansiyel müşteri",
  LINK_CLICKS: "Trafik",
  REACH: "Erişim",
  POST_ENGAGEMENT: "Etkileşim",
};

function objectiveLabel(v: string): string {
  if (!v) return "";
  return OBJECTIVE_LABEL[v] ?? v.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLocaleLowerCase("tr");
}

function fmtDay(ymd: string | null, today: string, yesterday: string): string {
  if (!ymd) return "—";
  if (ymd === today) return "Bugün";
  if (ymd === yesterday) return "Dün";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function normalize(s: string): string {
  return s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchesQuery(c: ActiveCampaign, brand: ActiveCampaignBrand, q: string): boolean {
  if (!q) return true;
  const hay = normalize(
    [brand.name, c.name, c.sourceName, c.objective, c.audience, c.location].join(" "),
  );
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Durum rozeti — Meta için reklam durumu kesin, diğerleri harcamaya göre. */
function StatusPill({ c, today, yesterday }: { c: ActiveCampaign; today: string; yesterday: string }) {
  if (c.live === true && c.spend7d <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200">
        <span className="size-1.5 rounded-full bg-sky-500" />
        Yeni · harcama yok
      </span>
    );
  }
  const fresh = c.lastDate === today || c.lastDate === yesterday;
  if (c.live === true || fresh) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
        Yayında
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200"
      title="Son 7 günde harcama var ama son iki gündür veri yok"
    >
      <span className="size-1.5 rounded-full bg-amber-500" />
      Yavaşladı
    </span>
  );
}

function BrandAvatar({ brand }: { brand: ActiveCampaignBrand }) {
  const media = resolveBrandCover({ slug: brand.slug, name: brand.name, coverUrl: brand.coverUrl });
  if (media) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.src}
        alt=""
        className={`size-10 shrink-0 rounded-xl border border-zinc-200 bg-white ${
          media.fit === "contain" ? "object-contain p-1" : "object-cover"
        }`}
      />
    );
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#141111] text-sm font-bold text-white">
      {brandInitials(brand.name)}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function MonthCell({ spent, budget, currency }: { spent: number; budget: number | null; currency: string }) {
  if (!budget) {
    return <span className="tabular-nums">{formatTry(spent, currency)}</span>;
  }
  const pct = Math.min(100, Math.round((spent / budget) * 100));
  const tone = pct > 105 ? "bg-rose-500" : pct > 90 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="min-w-[8rem]">
      <div className="flex items-baseline justify-between gap-2 tabular-nums">
        <span>{formatTry(spent, currency)}</span>
        <span className="text-[11px] text-zinc-500">/ {formatTry(budget, currency)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Aktif kampanyalar ekranı — markaya göre gruplu; marka / platform / arama
 * filtreleri ve harcamaya göre sıralama istemci tarafında.
 */
export default function ActiveCampaignsBoard({ snapshot }: { snapshot: ActiveCampaignsSnapshot }) {
  const { brands, totals, today, yesterday } = snapshot;
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState("");
  const [provider, setProvider] = useState<ProviderFilter>("");
  const [sort, setSort] = useState<SortKey>("spend7d");

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const out: ActiveCampaignBrand[] = [];
    for (const b of brands) {
      if (brandId && b.id !== brandId) continue;
      const campaigns = b.campaigns
        .filter((c) => (!provider || c.provider === provider) && matchesQuery(c, b, q))
        .sort((a, c) =>
          sort === "name"
            ? a.name.localeCompare(c.name, "tr")
            : c[sort] - a[sort] || a.name.localeCompare(c.name, "tr"),
        );
      if (campaigns.length === 0) continue;
      out.push({
        ...b,
        campaigns,
        spend7d: campaigns.reduce((s, c) => s + c.spend7d, 0),
        spendYesterday: campaigns.reduce((s, c) => s + c.spendYesterday, 0),
        spendMonth: campaigns.reduce((s, c) => s + c.spendMonth, 0),
      });
    }
    if (sort !== "name") out.sort((a, b) => b[sort] - a[sort]);
    return out;
  }, [brands, brandId, provider, query, sort]);

  const shownCount = visible.reduce((s, b) => s + b.campaigns.length, 0);
  const filtered = Boolean(query || brandId || provider);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Aktif kampanyalar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tüm markaların şu an yayındaki Meta ve Google Ads kampanyaları · son 7 günde
            harcaması olan veya Meta&apos;da yayında görünenler
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          Veri günü: <span className="font-medium text-zinc-700">{fmtDay(yesterday, today, yesterday)}</span>{" "}
          · bugünkü rakamlar saatlik güncellenir
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Aktif kampanya"
          value={formatNumber(totals.campaigns)}
          hint={`${totals.meta} Meta · ${totals.google} Google`}
        />
        <Stat label="Kampanyası olan marka" value={formatNumber(totals.brands)} />
        <Stat label="Dün harcama" value={formatTry(totals.spendYesterday)} hint="tüm aktif kampanyalar" />
        <Stat label="Son 7 gün harcama" value={formatTry(totals.spend7d)} hint={`bu ay ${formatTry(totals.spendMonth)}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kampanya, marka, hedef kitle ara"
            className={`${fieldClass} w-64 pl-9`}
          />
        </label>
        <select className={fieldClass} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">Tüm markalar</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.campaigns.length})
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["", "Tümü"],
            ["meta", "Meta"],
            ["google", "Google Ads"],
          ] as const).map(([v, label]) => (
            <button key={v} type="button" className={chipClass(provider === v)} onClick={() => setProvider(v)}>
              {label}
            </button>
          ))}
        </div>
        <select
          className={`${fieldClass} ml-auto`}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sıralama"
        >
          <option value="spend7d">Son 7 gün harcamaya göre</option>
          <option value="spendYesterday">Dünkü harcamaya göre</option>
          <option value="name">Ada göre</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
          <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <Megaphone className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-zinc-900">
            {filtered ? "Filtreye uyan kampanya yok" : "Şu an aktif kampanya görünmüyor"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            {filtered
              ? "Arama ya da filtreleri temizleyip tekrar deneyin."
              : "Son 7 günde harcaması olan kampanya bulunamadı. Veri çekimi henüz çalışmamış olabilir."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            {shownCount} kampanya · {visible.length} marka
          </p>
          {visible.map((b) => (
            <section key={b.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <header className="flex flex-wrap items-center gap-3 border-b border-zinc-100 bg-zinc-50/60 px-4 py-3">
                <BrandAvatar brand={b} />
                <div className="min-w-0">
                  <Link
                    href={`/brands/${encodeURIComponent(b.slug)}`}
                    className="text-sm font-semibold text-zinc-900 hover:text-[#e91825] hover:underline"
                  >
                    {b.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {b.campaigns.length} aktif kampanya · dün {formatTry(b.spendYesterday, b.currency)} · son 7 gün{" "}
                    {formatTry(b.spend7d, b.currency)}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {b.monthlyBudget ? (
                    <div className="hidden text-right sm:block">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Bu ay / plan</p>
                      <p className="text-sm font-semibold tabular-nums text-zinc-900">
                        {formatTry(b.spendMonth, b.currency)}{" "}
                        <span className="text-xs font-normal text-zinc-500">/ {formatTry(b.monthlyBudget, b.currency)}</span>
                      </p>
                    </div>
                  ) : null}
                  <Link
                    href={`/brands/${encodeURIComponent(b.slug)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-[#141111] hover:text-[#141111]"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Marka
                  </Link>
                </div>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2 font-semibold">Kampanya</th>
                      <th className="px-3 py-2 font-semibold">Durum</th>
                      <th className="px-3 py-2 text-right font-semibold">Dün</th>
                      <th className="px-3 py-2 text-right font-semibold">Son 7 gün</th>
                      <th className="px-3 py-2 font-semibold">Bu ay</th>
                      <th className="px-3 py-2 text-right font-semibold">Dönüşüm (7g)</th>
                      <th className="px-3 py-2 text-right font-semibold">Tıklama (7g)</th>
                      <th className="px-4 py-2 text-right font-semibold">Son veri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {b.campaigns.map((c) => (
                      <tr key={`${c.provider}:${c.campaignId}`} className="hover:bg-zinc-50/70">
                        <td className="max-w-[22rem] px-4 py-2.5">
                          <div className="flex items-start gap-2.5">
                            <PlatformBadge platform={c.provider} size="md" className="mt-0.5" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-zinc-900" title={c.sourceName}>
                                {c.name}
                              </p>
                              <p className="truncate text-[11px] text-zinc-500">
                                {[
                                  c.name !== c.sourceName ? c.sourceName : null,
                                  objectiveLabel(c.objective),
                                  c.audience,
                                  c.location,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || (c.provider === "meta" ? "Meta Ads" : "Google Ads")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill c={c} today={today} yesterday={yesterday} />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {c.spendYesterday > 0 ? formatTry(c.spendYesterday, b.currency) : <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {formatTry(c.spend7d, b.currency)}
                        </td>
                        <td className="px-3 py-2.5">
                          <MonthCell spent={c.spendMonth} budget={c.monthlyBudget} currency={b.currency} />
                          {c.dailyBudget ? (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-zinc-500">
                              <Wallet className="size-3" aria-hidden />
                              günlük {formatTry(c.dailyBudget, b.currency)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {c.conversions7d > 0 ? formatConv(c.conversions7d) : <span className="text-zinc-400">—</span>}
                          {c.convValue7d > 0 ? (
                            <span className="block text-[10px] text-zinc-500">{formatTry(c.convValue7d, b.currency)}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {c.clicks7d > 0 ? formatNumber(c.clicks7d) : <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-600">
                          {fmtDay(c.lastDate, today, yesterday)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
