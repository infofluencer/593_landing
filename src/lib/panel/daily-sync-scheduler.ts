import { istanbulYmd } from "@/lib/date/tr";
import { runScheduledDailySync } from "@/lib/panel/daily-sync";

const TICK_MS = 60_000;
const SLOT_HOURS = [9, 18] as const;
const SLOT_WINDOW_MINUTES = 15;

type GlobalScheduler = typeof globalThis & {
  __593DailySyncScheduler?: boolean;
};

function istanbulClock(date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

function slotKey(date = new Date()): string | null {
  const { hour, minute } = istanbulClock(date);
  if (
    !SLOT_HOURS.includes(hour as (typeof SLOT_HOURS)[number]) ||
    minute >= SLOT_WINDOW_MINUTES
  ) {
    return null;
  }
  return `${istanbulYmd(date)}-${String(hour).padStart(2, "0")}`;
}

/**
 * Self-host `next start` — İstanbul 09:00 ve 18:00 civarı günlük sync.
 * Üst üste binmeyi daily-sync kilit satırı engeller.
 */
export function startDailySyncScheduler() {
  const g = globalThis as GlobalScheduler;
  if (g.__593DailySyncScheduler) return;
  g.__593DailySyncScheduler = true;

  let lastSlot: string | null = null;
  let inFlight = false;

  const tick = async () => {
    const slot = slotKey();
    if (!slot || slot === lastSlot || inFlight) return;
    inFlight = true;
    try {
      const result = await runScheduledDailySync();
      if (!result.skipped) lastSlot = slot;
      else if (result.reason === "Bu slot zaten çekildi.") lastSlot = slot;
    } catch (err) {
      console.error("[daily-sync scheduler]", err);
    } finally {
      inFlight = false;
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, TICK_MS);
}
