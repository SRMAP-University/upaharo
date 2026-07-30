-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "deliveryRadiusTiers" JSONB;
