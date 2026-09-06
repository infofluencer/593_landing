-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('ecommerce', 'lead');

-- CreateEnum
CREATE TYPE "MetricOrigin" AS ENUM ('provider', 'derived');

-- DropForeignKey
ALTER TABLE "AdMetric" DROP CONSTRAINT "AdMetric_tenantId_fkey";

-- DropIndex
DROP INDEX "SyncJob_tenantId_provider_service_key";

-- AlterTable
ALTER TABLE "Alert" DROP COLUMN "assignee",
ADD COLUMN     "assigneeId" TEXT;

-- AlterTable
ALTER TABLE "SyncJob" ADD COLUMN     "objective" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "type" "TenantType" NOT NULL DEFAULT 'lead';

-- DropTable
DROP TABLE "AdMetric";

-- CreateTable
CREATE TABLE "MetaInsight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "frequency" DECIMAL(10,4),
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(10,6),
    "cpc" DECIMAL(14,4),
    "actions" JSONB NOT NULL DEFAULT '{}',
    "actionValues" JSONB NOT NULL DEFAULT '{}',
    "conversions" DECIMAL(14,4),
    "convValue" DECIMAL(14,2),
    "cpa" DECIMAL(14,4),
    "roas" DECIMAL(14,4),
    "ctrOrigin" "MetricOrigin" NOT NULL DEFAULT 'provider',
    "cpcOrigin" "MetricOrigin" NOT NULL DEFAULT 'provider',
    "cpaOrigin" "MetricOrigin" NOT NULL DEFAULT 'derived',
    "roasOrigin" "MetricOrigin" NOT NULL DEFAULT 'provider',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAdsMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(10,6),
    "cpc" DECIMAL(14,4),
    "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "convValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cpa" DECIMAL(14,4),
    "roas" DECIMAL(14,4),
    "ctrOrigin" "MetricOrigin" NOT NULL DEFAULT 'provider',
    "cpcOrigin" "MetricOrigin" NOT NULL DEFAULT 'provider',
    "cpaOrigin" "MetricOrigin" NOT NULL DEFAULT 'provider',
    "roasOrigin" "MetricOrigin" NOT NULL DEFAULT 'derived',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAdsMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ga4Metric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dimensionType" TEXT NOT NULL,
    "dimensionValue" TEXT NOT NULL DEFAULT '',
    "totalUsers" INTEGER,
    "sessions" INTEGER,
    "averageSessionDuration" DECIMAL(14,4),
    "bounceRate" DECIMAL(10,6),
    "screenPageViewsPerSession" DECIMAL(10,4),
    "sessionConversionRate" DECIMAL(10,6),
    "purchaseRevenue" DECIMAL(14,2),
    "transactions" INTEGER,
    "ecommercePurchases" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ga4Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaInsight_tenantId_date_idx" ON "MetaInsight"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetaInsight_tenantId_date_campaignId_objective_key" ON "MetaInsight"("tenantId", "date", "campaignId", "objective");

-- CreateIndex
CREATE INDEX "GoogleAdsMetric_tenantId_date_idx" ON "GoogleAdsMetric"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAdsMetric_tenantId_date_campaignId_key" ON "GoogleAdsMetric"("tenantId", "date", "campaignId");

-- CreateIndex
CREATE INDEX "Ga4Metric_tenantId_date_idx" ON "Ga4Metric"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Ga4Metric_tenantId_dimensionType_idx" ON "Ga4Metric"("tenantId", "dimensionType");

-- CreateIndex
CREATE UNIQUE INDEX "Ga4Metric_tenantId_date_dimensionType_dimensionValue_key" ON "Ga4Metric"("tenantId", "date", "dimensionType", "dimensionValue");

-- CreateIndex
CREATE UNIQUE INDEX "SyncJob_tenantId_provider_service_objective_key" ON "SyncJob"("tenantId", "provider", "service", "objective");

-- AddForeignKey
ALTER TABLE "MetaInsight" ADD CONSTRAINT "MetaInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAdsMetric" ADD CONSTRAINT "GoogleAdsMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ga4Metric" ADD CONSTRAINT "Ga4Metric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

