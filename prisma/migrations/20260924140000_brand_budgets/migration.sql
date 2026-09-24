-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "monthlyBudget" DECIMAL(14,2),
    "dailyBudget" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL DEFAULT '',
    "monthlyBudget" DECIMAL(14,2),
    "dailyBudget" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TenantBudget_tenantId_month_key" ON "TenantBudget"("tenantId", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantBudget_tenantId_idx" ON "TenantBudget"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignBudget_tenantId_month_provider_campaignId_key" ON "CampaignBudget"("tenantId", "month", "provider", "campaignId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignBudget_tenantId_month_idx" ON "CampaignBudget"("tenantId", "month");

-- AddForeignKey
ALTER TABLE "TenantBudget" DROP CONSTRAINT IF EXISTS "TenantBudget_tenantId_fkey";
ALTER TABLE "TenantBudget" ADD CONSTRAINT "TenantBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudget" DROP CONSTRAINT IF EXISTS "CampaignBudget_tenantId_fkey";
ALTER TABLE "CampaignBudget" ADD CONSTRAINT "CampaignBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
