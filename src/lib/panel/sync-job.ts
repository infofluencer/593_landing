import type { Provider, SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentSyncContext } from "@/lib/panel/sync-context";
import { IntegrationNotConfiguredError } from "@/lib/integrations/tokens";

const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(err: unknown): boolean {
  if (err instanceof IntegrationNotConfiguredError) return false;
  const message = err instanceof Error ? err.message : String(err);
  if (/eksik|yok —|tanımlı değil|formatı|eşleştirilmemiş|App Review|permission|OAuth/i.test(message))
    return false;
  // Meta'nın geçici hataları: "An unknown error occurred" (#1), "unexpected error" (#2), bozuk JSON gövdesi.
  return /429|500|502|503|504|ECONNRESET|ETIMEDOUT|rate limit|temporarily|timeout|TRY_AGAIN|unknown error occurred|unexpected error has occurred|geçersiz yanıt|Unexpected (non-whitespace|end of JSON|token)/i.test(
    message,
  );
}

export async function upsertSyncJob(opts: {
  tenantId: string;
  provider: Provider;
  service: string;
  objective?: string;
  status: SyncStatus;
  error?: string | null;
  markSuccess?: boolean;
  /** Geçmiş satırına yazılır (bitiş durumlarında). */
  startedAt?: Date | null;
  /** runSynced'in yaptığı toplam deneme. */
  attempts?: number;
}) {
  const objective = opts.objective ?? "default";
  const now = new Date();
  const failed = opts.status === "error";
  const job = await prisma.syncJob.upsert({
    where: {
      tenantId_provider_service_objective: {
        tenantId: opts.tenantId,
        provider: opts.provider,
        service: opts.service,
        objective,
      },
    },
    update: {
      status: opts.status,
      error: opts.error ?? null,
      ...(opts.markSuccess ? { lastSuccessAt: now } : {}),
      ...(failed ? { lastErrorAt: now } : {}),
      updatedAt: now,
    },
    create: {
      tenantId: opts.tenantId,
      provider: opts.provider,
      service: opts.service,
      objective,
      status: opts.status,
      error: opts.error ?? null,
      lastSuccessAt: opts.markSuccess ? now : null,
      lastErrorAt: failed ? now : null,
    },
  });

  if (opts.status === "success" || failed) {
    const ctx = currentSyncContext();
    await prisma.syncRun.create({
      data: {
        tenantId: opts.tenantId,
        provider: opts.provider,
        service: opts.service,
        objective,
        status: opts.status,
        error: opts.error ?? null,
        startedAt: opts.startedAt ?? null,
        finishedAt: now,
        durationMs: opts.startedAt
          ? now.getTime() - opts.startedAt.getTime()
          : null,
        trigger: ctx?.trigger ?? "manual",
        actorEmail: ctx?.actorEmail ?? null,
        attempts: opts.attempts ?? 1,
      },
    });
  }

  return job;
}

const SYNC_RUN_RETENTION_DAYS = 60;

/** Eski geçmiş satırlarını temizler — zamanlayıcı günde bir çağırır. */
export async function pruneSyncRuns() {
  const cutoff = new Date(Date.now() - SYNC_RUN_RETENTION_DAYS * 86_400_000);
  const { count } = await prisma.syncRun.deleteMany({
    where: { finishedAt: { lt: cutoff } },
  });
  return count;
}

/**
 * Run a sync unit with up to MAX_ATTEMPTS retries on transient errors.
 * Never writes metric zeros on failure — caller only persists inside `fn` on success.
 */
export async function runSynced<T>(
  opts: {
    tenantId: string;
    provider: Provider;
    service: string;
    objective?: string;
  },
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const startedAt = new Date();
  await upsertSyncJob({
    ...opts,
    status: "running",
    error: null,
  });

  let lastError = "unknown";
  let attempts = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    try {
      const data = await fn();
      await upsertSyncJob({
        ...opts,
        status: "success",
        error: null,
        markSuccess: true,
        startedAt,
        attempts: attempt,
      });
      return { ok: true, data };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const retry =
        attempt < MAX_ATTEMPTS && isRetryable(err);
      if (retry) {
        // Meta "Service temporarily unavailable" / limit hatalarında kısa bekleme
        // işe yaramıyor; 15–30 s dinlendirip yeniden dene.
        const heavy = /temporarily|rate limit|limit reached|429|unknown error|unexpected error/i.test(lastError);
        await sleep(heavy ? 15_000 * attempt : 400 * attempt * attempt);
        continue;
      }
      break;
    }
  }

  await upsertSyncJob({
    ...opts,
    status: "error",
    error: lastError,
    startedAt,
    attempts,
  });
  // Never write zero metrics on failure.
  return { ok: false, error: lastError };
}
