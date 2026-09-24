-- CreateTable
CREATE TABLE IF NOT EXISTS "CampaignAlias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "campaignId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignAlias_tenantId_provider_campaignId_key" ON "CampaignAlias"("tenantId", "provider", "campaignId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignAlias_tenantId_idx" ON "CampaignAlias"("tenantId");

-- AddForeignKey
ALTER TABLE "CampaignAlias" DROP CONSTRAINT IF EXISTS "CampaignAlias_tenantId_fkey";
ALTER TABLE "CampaignAlias" ADD CONSTRAINT "CampaignAlias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
