-- Meta ad creatives + ad-level daily insights
CREATE TABLE "MetaAd" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL DEFAULT '',
    "adsetId" TEXT NOT NULL DEFAULT '',
    "adsetName" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "effectiveStatus" TEXT NOT NULL DEFAULT '',
    "creativeId" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT,
    "imageUrl" TEXT,
    "permalinkUrl" TEXT,
    "linkUrl" TEXT,
    "objectType" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaAdInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL DEFAULT '',
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "adsetId" TEXT NOT NULL DEFAULT '',
    "adsetName" TEXT NOT NULL DEFAULT '',
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

    CONSTRAINT "MetaAdInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetaAd_tenantId_adId_key" ON "MetaAd"("tenantId", "adId");
CREATE INDEX "MetaAd_tenantId_effectiveStatus_idx" ON "MetaAd"("tenantId", "effectiveStatus");

CREATE UNIQUE INDEX "MetaAdInsight_tenantId_date_adId_key" ON "MetaAdInsight"("tenantId", "date", "adId");
CREATE INDEX "MetaAdInsight_tenantId_date_idx" ON "MetaAdInsight"("tenantId", "date");
CREATE INDEX "MetaAdInsight_tenantId_adId_idx" ON "MetaAdInsight"("tenantId", "adId");

ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAdInsight" ADD CONSTRAINT "MetaAdInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
