import { connection } from "next/server";
import { istanbulYmd } from "@/lib/date/tr";

/**
 * Request-time “today” in Europe/Istanbul.
 * Awaits connection() so static/ISR cache cannot freeze the calendar day.
 */
export async function getIstanbulTodayYmd(): Promise<string> {
  await connection();
  return istanbulYmd(new Date());
}
