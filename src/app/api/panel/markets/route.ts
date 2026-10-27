import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Kurlar günde bir güncellenir (ECB bazlı), altın canlı; 5 dk bellek önbelleği. */
const TTL_MS = 5 * 60 * 1000;
const TROY_OUNCE_G = 31.1034768;

export type MarketsNow = {
  /** 1 USD kaç TL */
  usdTry: number;
  /** 1 EUR kaç TL */
  eurTry: number;
  /** 1 gram altın kaç TL (ons/USD × USD/TL) */
  goldGramTry: number;
  /** Ons altın, USD */
  goldOunceUsd: number;
  ratesAt: string;
  goldAt: string;
  fetchedAt: string;
};

type ErApi = {
  result?: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
};
type GoldApi = { price?: number; updatedAt?: string };

const g = globalThis as unknown as {
  __panelMarkets?: { at: number; data: MarketsNow };
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

async function load(): Promise<MarketsNow> {
  const cached = g.__panelMarkets;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  const [fx, gold] = await Promise.all([
    getJson<ErApi>("https://open.er-api.com/v6/latest/USD"),
    getJson<GoldApi>("https://api.gold-api.com/price/XAU"),
  ]);

  const usdTry = fx.rates?.TRY;
  const usdEur = fx.rates?.EUR;
  const ounceUsd = gold.price;
  if (
    fx.result !== "success" ||
    typeof usdTry !== "number" ||
    typeof usdEur !== "number" ||
    typeof ounceUsd !== "number"
  ) {
    throw new Error("piyasa verisi eksik");
  }

  const data: MarketsNow = {
    usdTry,
    eurTry: usdTry / usdEur,
    goldGramTry: (ounceUsd / TROY_OUNCE_G) * usdTry,
    goldOunceUsd: ounceUsd,
    ratesAt: fx.time_last_update_utc
      ? new Date(fx.time_last_update_utc).toISOString()
      : new Date().toISOString(),
    goldAt: gold.updatedAt ?? new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };
  g.__panelMarkets = { at: Date.now(), data };
  return data;
}

export async function GET() {
  try {
    const data = await load();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=120" },
    });
  } catch (e) {
    const stale = g.__panelMarkets?.data;
    if (stale) return NextResponse.json({ ...stale, stale: true });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "markets" },
      { status: 503 },
    );
  }
}
