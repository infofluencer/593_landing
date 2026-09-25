export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.DAILY_SYNC_DISABLED === "true") return;

  const { startDailySyncScheduler } = await import(
    "@/lib/panel/daily-sync-scheduler"
  );
  startDailySyncScheduler();
}
