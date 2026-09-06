-- CreateEnum
CREATE TYPE "SiteVerifyStatus" AS ENUM ('not_tested', 'pass', 'fail', 'partial', 'unknown', 'error');

-- CreateTable
CREATE TABLE "SiteVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "SiteVerifyStatus" NOT NULL DEFAULT 'not_tested',
    "checkedAt" TIMESTAMP(3),
    "summary" TEXT,
    "scenarios" JSONB NOT NULL DEFAULT '[]',
    "findings" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteVerification_tenantId_key" ON "SiteVerification"("tenantId");

-- AddForeignKey
ALTER TABLE "SiteVerification" ADD CONSTRAINT "SiteVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
