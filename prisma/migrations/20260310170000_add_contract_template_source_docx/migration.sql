-- AlterTable
ALTER TABLE "ContractTemplate"
ADD COLUMN "sourceFileName" TEXT,
ADD COLUMN "sourceMimeType" TEXT,
ADD COLUMN "sourceStoragePath" TEXT;
