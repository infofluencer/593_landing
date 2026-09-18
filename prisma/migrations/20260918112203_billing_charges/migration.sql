-- CreateTable
CREATE TABLE "BillingCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "chargedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "viewUrl" TEXT,
    "invoiceNumber" TEXT,
    "billingSetupId" TEXT,
    "issueYear" INTEGER,
    "issueMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingCharge_tenantId_chargedAt_idx" ON "BillingCharge"("tenantId", "chargedAt");

-- CreateIndex
CREATE INDEX "BillingCharge_tenantId_provider_idx" ON "BillingCharge"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCharge_tenantId_provider_externalId_key" ON "BillingCharge"("tenantId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "BillingCharge" ADD CONSTRAINT "BillingCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
