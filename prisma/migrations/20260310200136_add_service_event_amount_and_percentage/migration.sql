-- AlterTable
ALTER TABLE "ClientService" ADD COLUMN     "eventAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "servicePercentage" DECIMAL(5,2) NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN     "defaultPercentage" DECIMAL(5,2) NOT NULL DEFAULT 100;

-- Backfill
UPDATE "ClientService"
SET
  "eventAmount" = "amount",
  "servicePercentage" = 100
WHERE "eventAmount" = 0;
