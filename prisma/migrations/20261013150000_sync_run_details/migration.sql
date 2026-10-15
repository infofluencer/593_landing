-- Senkron logu ayrıntıları: süre, tetikleyen, kim, deneme sayısı
ALTER TABLE "SyncRun" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "SyncRun" ADD COLUMN "trigger" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "SyncRun" ADD COLUMN "actorEmail" TEXT;
ALTER TABLE "SyncRun" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1;

-- Mevcut satırlar için süre
UPDATE "SyncRun"
SET "durationMs" = (EXTRACT(EPOCH FROM ("finishedAt" - "startedAt")) * 1000)::int
WHERE "startedAt" IS NOT NULL AND "durationMs" IS NULL;
