-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Mevcut markaları ada göre sıraya diz
WITH ordered AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY name ASC) - 1)::int AS pos
  FROM "Tenant"
)
UPDATE "Tenant" t
SET "sortOrder" = ordered.pos
FROM ordered
WHERE t.id = ordered.id;
