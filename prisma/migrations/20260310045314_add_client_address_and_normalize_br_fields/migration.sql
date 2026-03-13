-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "address" TEXT;

-- Normalize existing Brazilian identifiers and phone numbers to digits only.
UPDATE "Client"
SET
  "documentNumber" = regexp_replace("documentNumber", '\D', '', 'g'),
  "phone" = regexp_replace("phone", '\D', '', 'g')
WHERE "documentNumber" IS NOT NULL OR "phone" IS NOT NULL;
