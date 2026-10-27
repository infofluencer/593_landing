import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Ajans ofisi — Beyoğlu/İstanbul. */
const LAT = 41.0369;
const LON = 28.985;
const CITY = "İstanbul";
/** Open-Meteo anahtarsızdır; 10 dk bellek önbelleği ile yük düşük tutulur. */
const TTL_MS = 10 * 60 * 1000;

export type WeatherNow = {
  city: string;
  tempC: number;
  feelsC: number;
  code: number;
  isDay: boolean;
  windKmh: number;
  fetchedAt: string;
};

type OpenMeteo = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    is_day?: number;
    wind_speed_10m?: number;
  };
};

const g = globalThis as unknown as {
  __panelWeather?: { at: number; data: WeatherNow };
};

async function load(): Promise<WeatherNow> {
  const cached = g.__panelWeather;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LAT));
  url.searchParams.set("longitude", String(LON));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m",
  );
  url.searchParams.set("timezone", "Europe/Istanbul");

  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const json = (await res.json()) as OpenMeteo;
  const c = json.current;
  if (!c || typeof c.temperature_2m !== "number") {
    throw new Error("open-meteo: eksik veri");
  }
  const data: WeatherNow = {
    city: CITY,
    tempC: Math.round(c.temperature_2m),
    feelsC: Math.round(c.apparent_temperature ?? c.temperature_2m),
    code: c.weather_code ?? 0,
    isDay: (c.is_day ?? 1) === 1,
    windKmh: Math.round(c.wind_speed_10m ?? 0),
    fetchedAt: new Date().toISOString(),
  };
  g.__panelWeather = { at: Date.now(), data };
  return data;
}

export async function GET() {
  try {
    const data = await load();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (e) {
    // Eski veri varsa onu ver; yoksa 503.
    const stale = g.__panelWeather?.data;
    if (stale) return NextResponse.json({ ...stale, stale: true });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "weather" },
      { status: 503 },
    );
  }
}
