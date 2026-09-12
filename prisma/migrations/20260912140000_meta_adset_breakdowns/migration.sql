-- Meta ad set daily insights + placement/device/age breakdowns
CREATE TABLE "MetaAdsetInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "adsetId" TEXT NOT NULL,
    "adsetName" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(10,6),
    "cpc" DECIMAL(14,4),
    "actions" JSONB NOT NULL DEFAULT '{}',
    "actionValues" JSONB NOT NULL DEFAULT '{}',
    "conversions" DECIMAL(14,4),
    "convValue" DECIMAL(14,2),
    "cpa" DECIMAL(14,4),
    "roas" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdsetInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaBreakdownInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "breakdown" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(14,4),
    "convValue" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaBreakdownInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetaAdsetInsight_tenantId_date_adsetId_key" ON "MetaAdsetInsight"("tenantId", "date", "adsetId");
CREATE INDEX "MetaAdsetInsight_tenantId_date_idx" ON "MetaAdsetInsight"("tenantId", "date");
CREATE INDEX "MetaAdsetInsight_tenantId_adsetId_idx" ON "MetaAdsetInsight"("tenantId", "adsetId");

CREATE UNIQUE INDEX "MetaBreakdownInsight_tenantId_date_breakdown_key_key" ON "MetaBreakdownInsight"("tenantId", "date", "breakdown", "key");
CREATE INDEX "MetaBreakdownInsight_tenantId_date_idx" ON "MetaBreakdownInsight"("tenantId", "date");
CREATE INDEX "MetaBreakdownInsight_tenantId_breakdown_idx" ON "MetaBreakdownInsight"("tenantId", "breakdown");

ALTER TABLE "MetaAdsetInsight" ADD CONSTRAINT "MetaAdsetInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaBreakdownInsight" ADD CONSTRAINT "MetaBreakdownInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
