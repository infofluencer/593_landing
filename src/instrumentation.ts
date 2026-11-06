import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.DAILY_SYNC_DISABLED === "true") return;

  const { startDailySyncScheduler } = await import(
    "@/lib/panel/daily-sync-scheduler"
  );
  startDailySyncScheduler();
}

/**
 * Sunucu hatalarını tek satır JSON olarak loglar (Dokploy container logu).
 * Canlıda kullanıcı yalnızca "Hata kodu" (digest) görür; bu satır o kodu
 * gerçek mesaj, stack ve sayfa yoluyla eşleştirir — logda digest'i arat.
 */
export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  const e = err instanceof Error ? err : null;
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest: unknown }).digest)
      : undefined;

  console.error(
    "[server-error]",
    JSON.stringify({
      at: new Date().toISOString(),
      digest,
      message: e?.message ?? String(err),
      stack: e?.stack?.split("\n").slice(0, 12).join("\n"),
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );
};
