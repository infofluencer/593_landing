-- CreateEnum
CREATE TYPE "BrandNoteKind" AS ENUM ('general', 'meeting', 'request', 'document', 'link');

-- CreateEnum
CREATE TYPE "ContentPostStatus" AS ENUM ('draft', 'design', 'review', 'published');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('none', 'weekly', 'monthly');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifiedSeverity" "AlertSeverity";

-- AlterTable
ALTER TABLE "MetaAd" ADD COLUMN     "urlTags" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "reportEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reportFrequency" "ReportFrequency" NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "TenantThreshold" ADD COLUMN     "cplTarget" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "BrandNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorEmail" TEXT,
    "kind" "BrandNoteKind" NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "meetingAt" TIMESTAMP(3),
    "teamId" TEXT,
    "boardCardId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ContentPostStatus" NOT NULL DEFAULT 'draft',
    "brief" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigneeId" TEXT,
    "designerId" TEXT,
    "createdById" TEXT,
    "boardCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "sentTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "alertId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandNote_boardCardId_key" ON "BrandNote"("boardCardId");

-- CreateIndex
CREATE INDEX "BrandNote_tenantId_createdAt_idx" ON "BrandNote"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPost_boardCardId_key" ON "ContentPost"("boardCardId");

-- CreateIndex
CREATE INDEX "ContentPost_tenantId_scheduledAt_idx" ON "ContentPost"("tenantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContentPost_scheduledAt_idx" ON "ContentPost"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SetupCheck_tenantId_key_key" ON "SetupCheck"("tenantId", "key");

-- CreateIndex
CREATE INDEX "BrandReport_tenantId_createdAt_idx" ON "BrandReport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_alertId_idx" ON "NotificationLog"("alertId");

-- AddForeignKey
ALTER TABLE "BrandNote" ADD CONSTRAINT "BrandNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNote" ADD CONSTRAINT "BrandNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNote" ADD CONSTRAINT "BrandNote_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandNote" ADD CONSTRAINT "BrandNote_boardCardId_fkey" FOREIGN KEY ("boardCardId") REFERENCES "BoardCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_boardCardId_fkey" FOREIGN KEY ("boardCardId") REFERENCES "BoardCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupCheck" ADD CONSTRAINT "SetupCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReport" ADD CONSTRAINT "BrandReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReport" ADD CONSTRAINT "BrandReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
