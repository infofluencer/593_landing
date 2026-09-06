-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'team', 'client');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('google', 'meta');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('ok', 'warn', 'critical', 'unknown');

-- CreateEnum
CREATE TYPE "ConversionKind" AS ENUM ('whatsapp', 'form', 'sale', 'other');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('pending', 'running', 'success', 'error');

-- CreateTable
CREATE TABLE "AgencyConnection" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "oauthTokenRef" TEXT NOT NULL,
    "loginCustomerId" TEXT,
    "businessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "metaAccountId" TEXT NOT NULL,
    "monthlyBudget" DECIMAL(14,2),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adsCustomerId" TEXT,
    "ga4PropertyId" TEXT,
    "gtmContainerId" TEXT,
    "gscSiteUrl" TEXT,
    "merchantId" TEXT,

    CONSTRAINT "TenantMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaign" TEXT NOT NULL DEFAULT '',
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impr" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conv" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "convValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "roas" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "count" INTEGER NOT NULL DEFAULT 0,
    "kind" "ConversionKind" NOT NULL DEFAULT 'other',
    "dupeFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT,
    "assignee" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "service" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'pending',
    "lastSuccessAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyConnection_provider_key" ON "AgencyConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_metaAccountId_key" ON "Tenant"("metaAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMapping_tenantId_key" ON "TenantMapping"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "AdMetric_tenantId_date_idx" ON "AdMetric"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdMetric_tenantId_date_campaign_key" ON "AdMetric"("tenantId", "date", "campaign");

-- CreateIndex
CREATE INDEX "Conversion_tenantId_date_idx" ON "Conversion"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Conversion_tenantId_kind_idx" ON "Conversion"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "Alert_tenantId_resolved_idx" ON "Alert"("tenantId", "resolved");

-- CreateIndex
CREATE INDEX "Alert_tenantId_severity_idx" ON "Alert"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "SyncJob_tenantId_status_idx" ON "SyncJob"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SyncJob_tenantId_provider_service_key" ON "SyncJob"("tenantId", "provider", "service");

-- AddForeignKey
ALTER TABLE "TenantMapping" ADD CONSTRAINT "TenantMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetric" ADD CONSTRAINT "AdMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
