import { AsyncLocalStorage } from "node:async_hooks";

/** Senkronu kim / ne başlattı — SyncRun log satırına yazılır. */
export type SyncTrigger = "manual" | "retry" | "cron" | "backfill";

export type SyncContext = {
  trigger: SyncTrigger;
  actorEmail?: string | null;
};

const storage = new AsyncLocalStorage<SyncContext>();

/**
 * runAgencySync derinlerindeki runSynced çağrılarına parametre taşımadan
 * tetikleyen bilgisini ulaştırır.
 */
export function runWithSyncContext<T>(
  ctx: SyncContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentSyncContext(): SyncContext | undefined {
  return storage.getStore();
}
