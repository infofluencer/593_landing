"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { WeatherNow } from "@/app/api/panel/weather/route";
import type { MarketsNow } from "@/app/api/panel/markets/route";

const TZ = "Europe/Istanbul";
const WEATHER_URL = "/api/panel/weather";
const WEATHER_EVERY_MS = 10 * 60 * 1000;
const MARKETS_URL = "/api/panel/markets";
const MARKETS_EVERY_MS = 5 * 60 * 1000;

const tryFmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const tryFmt0 = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

/** Sunucudan aralıklı veri çeker; sekme görünür olunca tazeler. */
function usePolled<T>(url: string, everyMs: number, ok: (d: T) => boolean) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as T;
        if (alive && ok(d)) setData(d);
      } catch {
        // Ağ hatası: eldeki değer kalır.
      }
    };
    load();
    const id = window.setInterval(load, everyMs);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [url, everyMs, ok]);
  return data;
}

const weatherOk = (d: WeatherNow) => typeof d.tempC === "number";
const marketsOk = (d: MarketsNow) =>
  typeof d.usdTry === "number" && typeof d.goldGramTry === "number";

/** WMO hava kodu → Türkçe etiket + ikon. */
function describe(code: number, isDay: boolean): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: "Açık", Icon: isDay ? Sun : Moon };
  if (code === 1) return { label: "Az bulutlu", Icon: isDay ? CloudSun : Moon };
  if (code === 2) return { label: "Parçalı bulutlu", Icon: CloudSun };
  if (code === 3) return { label: "Kapalı", Icon: Cloud };
  if (code === 45 || code === 48) return { label: "Sisli", Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Çiseleme", Icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { label: "Yağmurlu", Icon: CloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { label: "Karlı", Icon: CloudSnow };
  if (code >= 95) return { label: "Fırtına", Icon: CloudLightning };
  return { label: "Bulutlu", Icon: Cloud };
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

/** Üst çubuk sağı: hava durumu · tarih · saat (yalnızca istemcide, SSR'da boş). */
export default function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  const weather = usePolled<WeatherNow>(WEATHER_URL, WEATHER_EVERY_MS, weatherOk);
  const markets = usePolled<MarketsNow>(MARKETS_URL, MARKETS_EVERY_MS, marketsOk);

  // Saat: dakika sınırına hizalı tik.
  useEffect(() => {
    let t: number;
    const tick = () => {
      const d = new Date();
      setNow(d);
      t = window.setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    tick();
    return () => window.clearTimeout(t);
  }, []);

  if (!now) return <div className="hidden h-8 sm:block" aria-hidden />;

  const w = weather ? describe(weather.code, weather.isDay) : null;

  return (
    <div
      className="hidden shrink-0 items-center divide-x divide-panel-border text-panel-fg sm:flex"
      aria-label="Tarih, saat ve hava durumu"
    >
      {markets ? (
        <dl
          className="hidden items-center gap-3 pr-3 lg:flex"
          title={`Kurlar: ${new Date(markets.ratesAt).toLocaleString("tr-TR")} · Ons altın: ${markets.goldOunceUsd.toFixed(0)} $`}
        >
          <Rate label="USD" value={tryFmt.format(markets.usdTry)} />
          <Rate label="EUR" value={tryFmt.format(markets.eurTry)} />
          <Rate label="Gram altın" value={tryFmt0.format(markets.goldGramTry)} />
        </dl>
      ) : null}

      {weather && w ? (
        <div
          className="hidden items-center gap-2 px-3 md:flex"
          title={`${weather.city} · ${w.label} · hissedilen ${weather.feelsC}° · rüzgar ${weather.windKmh} km/sa`}
        >
          <w.Icon className="size-[18px] text-panel-fg-secondary" aria-hidden strokeWidth={1.75} />
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tabular-nums">
              {weather.tempC}°
              <span className="ml-1 font-medium text-panel-fg-secondary">{w.label}</span>
            </p>
            <p className="text-[10px] text-panel-fg-muted">{weather.city}</p>
          </div>
        </div>
      ) : null}

      <div className="pl-3 leading-tight">
        <p className="text-[13px] font-semibold tabular-nums">
          <time dateTime={now.toISOString()}>{timeFmt.format(now)}</time>
        </p>
        <p className="text-[10px] capitalize text-panel-fg-muted">{dateFmt.format(now)}</p>
      </div>
    </div>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <dt className="text-[10px] uppercase tracking-[0.08em] text-panel-fg-muted">
        {label}
      </dt>
      <dd className="text-[13px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
