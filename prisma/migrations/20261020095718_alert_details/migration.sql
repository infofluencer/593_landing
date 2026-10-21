-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "details" JSONB NOT NULL DEFAULT '{}';
