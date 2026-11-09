-- CreateEnum
CREATE TYPE "OfficeShiftKind" AS ENUM ('office', 'remote', 'off');

-- CreateTable
CREATE TABLE "OfficeShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "OfficeShiftKind" NOT NULL,
    "note" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficeShift_userId_date_key" ON "OfficeShift"("userId", "date");

-- CreateIndex
CREATE INDEX "OfficeShift_date_idx" ON "OfficeShift"("date");

-- AddForeignKey
ALTER TABLE "OfficeShift" ADD CONSTRAINT "OfficeShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeShift" ADD CONSTRAINT "OfficeShift_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
