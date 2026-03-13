-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('PERSONAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'BUSINESS',
ALTER COLUMN "legalName" DROP NOT NULL;
