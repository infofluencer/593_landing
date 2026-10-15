-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "disabledIntegrations" TEXT[] DEFAULT ARRAY[]::TEXT[];

