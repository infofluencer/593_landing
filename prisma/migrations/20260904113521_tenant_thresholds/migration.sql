-- CreateTable
CREATE TABLE "TenantThreshold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "budgetPaceWarnPct" INTEGER NOT NULL DEFAULT 85,
    "convDropoutDays" INTEGER NOT NULL DEFAULT 3,
    "minSpendForAlert" DECIMAL(14,2) NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantThreshold_tenantId_key" ON "TenantThreshold"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantThreshold" ADD CONSTRAINT "TenantThreshold_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
