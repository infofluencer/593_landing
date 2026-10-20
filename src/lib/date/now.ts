import { connection } from "next/server";
import { istanbulYmd } from "@/lib/date/tr";

/**
 * Request-time “today” in Europe/Istanbul.
 * Awaits connection() so static/ISR cache cannot freeze the calendar day.
 * Zamanlayıcı / script gibi istek dışı bağlamlarda connection() fırlatır;
 * orada doğrudan saat kullanılır.
 */
export async function getIstanbulTodayYmd(): Promise<string> {
  try {
    await connection();
  } catch {
    // İstek kapsamı yok (cron, CLI) — önbellek sorunu da yok.
  }
  return istanbulYmd(new Date());
}
