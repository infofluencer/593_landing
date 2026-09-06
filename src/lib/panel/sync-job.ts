import type { Provider, SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
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
  return /429|500|502|503|504|ECONNRESET|ETIMEDOUT|rate limit|temporarily|timeout|TRY_AGAIN/i.test(
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
}) {
  const objective = opts.objective ?? "default";
  const now = new Date();
  return prisma.syncJob.upsert({
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
    },
  });
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
  await upsertSyncJob({
    ...opts,
    status: "running",
    error: null,
  });

  let lastError = "unknown";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await fn();
      await upsertSyncJob({
        ...opts,
        status: "success",
        error: null,
        markSuccess: true,
      });
      return { ok: true, data };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const retry =
        attempt < MAX_ATTEMPTS && isRetryable(err);
      if (retry) {
        await sleep(400 * attempt * attempt);
        continue;
      }
      break;
    }
  }

  await upsertSyncJob({
    ...opts,
    status: "error",
    error: lastError,
  });
  // Never write zero metrics on failure.
  return { ok: false, error: lastError };
}
