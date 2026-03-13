-- Create the service catalog and migrate existing client-linked services into it.
CREATE TABLE "ServiceCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ServiceCatalog" (
    "id",
    "name",
    "description",
    "defaultAmount",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "description",
    "amount",
    true,
    "createdAt",
    "updatedAt"
FROM "ClientService";

ALTER TABLE "ClientService"
ADD COLUMN "serviceCatalogId" TEXT,
ADD COLUMN "identificationNumber" TEXT;

UPDATE "ClientService"
SET "serviceCatalogId" = "id"
WHERE "serviceCatalogId" IS NULL;

ALTER TABLE "ClientService"
ALTER COLUMN "serviceCatalogId" SET NOT NULL;

DROP INDEX IF EXISTS "ClientService_name_idx";

ALTER TABLE "ClientService"
DROP COLUMN "name";

CREATE INDEX "ServiceCatalog_name_idx" ON "ServiceCatalog"("name");
CREATE INDEX "ClientService_serviceCatalogId_idx" ON "ClientService"("serviceCatalogId");
CREATE INDEX "ClientService_identificationNumber_idx" ON "ClientService"("identificationNumber");

ALTER TABLE "ClientService"
ADD CONSTRAINT "ClientService_serviceCatalogId_fkey"
FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
