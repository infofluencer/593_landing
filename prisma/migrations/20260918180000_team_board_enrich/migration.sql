-- AlterTable Team: slug + color
ALTER TABLE "Team" ADD COLUMN "slug" TEXT;
ALTER TABLE "Team" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#71717a';

-- Backfill slug from name (unique)
UPDATE "Team"
SET "slug" = lower(regexp_replace(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE "slug" IS NULL OR "slug" = '';

-- Deduplicate slugs if needed
WITH ranked AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt") AS rn
  FROM "Team"
)
UPDATE "Team" t
SET slug = t.slug || '-' || substring(t.id from 1 for 6)
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

ALTER TABLE "Team" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- Seed known team colors when name matches defaults
UPDATE "Team" SET "color" = '#0866FF' WHERE lower("name") = 'meta';
UPDATE "Team" SET "color" = '#4285F4' WHERE lower("name") = 'google';
UPDATE "Team" SET "color" = '#E37400' WHERE lower("name") = 'analytics';
UPDATE "Team" SET "color" = '#7C3AED' WHERE lower("name") IN ('kreatif', 'creative');
UPDATE "Team" SET "color" = '#0D9488' WHERE lower("name") IN ('hesap yönetimi', 'hesap yonetimi', 'account');

-- BoardCard: new fields
ALTER TABLE "BoardCard" ADD COLUMN "teamId" TEXT;
ALTER TABLE "BoardCard" ADD COLUMN "labels" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BoardCard" ADD COLUMN "sourceAlertId" TEXT;

-- Multi-assignee join table
CREATE TABLE "BoardCardAssignee" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardCardAssignee_pkey" PRIMARY KEY ("id")
);

-- Migrate single assignee → join rows
INSERT INTO "BoardCardAssignee" ("id", "cardId", "userId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), "id", "assigneeId", CURRENT_TIMESTAMP
FROM "BoardCard"
WHERE "assigneeId" IS NOT NULL;

CREATE UNIQUE INDEX "BoardCardAssignee_cardId_userId_key" ON "BoardCardAssignee"("cardId", "userId");
CREATE INDEX "BoardCardAssignee_userId_idx" ON "BoardCardAssignee"("userId");

ALTER TABLE "BoardCardAssignee" ADD CONSTRAINT "BoardCardAssignee_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BoardCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardCardAssignee" ADD CONSTRAINT "BoardCardAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old single-assignee FK + column + index
DROP INDEX IF EXISTS "BoardCard_assigneeId_idx";
ALTER TABLE "BoardCard" DROP CONSTRAINT IF EXISTS "BoardCard_assigneeId_fkey";
ALTER TABLE "BoardCard" DROP COLUMN IF EXISTS "assigneeId";

-- Activity log
CREATE TABLE "BoardCardActivity" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardCardActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BoardCardActivity_cardId_createdAt_idx" ON "BoardCardActivity"("cardId", "createdAt");

ALTER TABLE "BoardCardActivity" ADD CONSTRAINT "BoardCardActivity_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BoardCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardCardActivity" ADD CONSTRAINT "BoardCardActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BoardCard FKs for team + alert
CREATE INDEX "BoardCard_teamId_idx" ON "BoardCard"("teamId");
CREATE INDEX "BoardCard_sourceAlertId_idx" ON "BoardCard"("sourceAlertId");
CREATE INDEX "BoardCard_dueAt_idx" ON "BoardCard"("dueAt");

ALTER TABLE "BoardCard" ADD CONSTRAINT "BoardCard_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BoardCard" ADD CONSTRAINT "BoardCard_sourceAlertId_fkey" FOREIGN KEY ("sourceAlertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
