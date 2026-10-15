-- CreateTable
CREATE TABLE "HourlySpend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HourlySpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountHealth" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "status" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HourlySpend_date_idx" ON "HourlySpend"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HourlySpend_tenantId_provider_date_hour_key" ON "HourlySpend"("tenantId", "provider", "date", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "AccountHealth_tenantId_provider_key" ON "AccountHealth"("tenantId", "provider");

-- AddForeignKey
ALTER TABLE "HourlySpend" ADD CONSTRAINT "HourlySpend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHealth" ADD CONSTRAINT "AccountHealth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

