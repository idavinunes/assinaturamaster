CREATE TYPE "ClientDocumentType" AS ENUM (
  'PRIMARY_DOCUMENT',
  'RG',
  'ADDRESS_PROOF',
  'OTHER'
);

CREATE TABLE "ClientDocument" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "documentType" "ClientDocumentType" NOT NULL,
  "description" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
  "storagePath" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClientDocument"
ADD CONSTRAINT "ClientDocument_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ClientDocument"
ADD CONSTRAINT "ClientDocument_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "ClientDocument_clientId_createdAt_idx"
ON "ClientDocument"("clientId", "createdAt");

CREATE INDEX "ClientDocument_teamId_documentType_idx"
ON "ClientDocument"("teamId", "documentType");

CREATE INDEX "ClientDocument_teamId_createdAt_idx"
ON "ClientDocument"("teamId", "createdAt");
