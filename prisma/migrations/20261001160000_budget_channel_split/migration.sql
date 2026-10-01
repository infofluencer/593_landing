-- Marka aylık planı: kanal payı + not
ALTER TABLE "TenantBudget" ADD COLUMN IF NOT EXISTS "googleBudget" DECIMAL(14,2);
ALTER TABLE "TenantBudget" ADD COLUMN IF NOT EXISTS "metaBudget" DECIMAL(14,2);
ALTER TABLE "TenantBudget" ADD COLUMN IF NOT EXISTS "note" TEXT NOT NULL DEFAULT '';
