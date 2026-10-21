-- AlterTable
ALTER TABLE "BoardCard" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
