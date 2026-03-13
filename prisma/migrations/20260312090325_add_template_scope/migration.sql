CREATE TYPE "TemplateScope" AS ENUM ('GLOBAL', 'TEAM_PRIVATE');

ALTER TABLE "ContractTemplate"
ADD COLUMN "scope" "TemplateScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN "ownerTeamId" TEXT;

ALTER TABLE "ContractTemplate"
DROP CONSTRAINT IF EXISTS "ContractTemplate_name_version_key";

ALTER TABLE "ContractTemplate"
ADD CONSTRAINT "ContractTemplate_ownerTeamId_fkey"
FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ContractTemplate_ownerTeamId_name_version_key"
ON "ContractTemplate"("ownerTeamId", "name", "version");

CREATE INDEX "ContractTemplate_scope_updatedAt_idx"
ON "ContractTemplate"("scope", "updatedAt");

CREATE INDEX "ContractTemplate_ownerTeamId_updatedAt_idx"
ON "ContractTemplate"("ownerTeamId", "updatedAt");
