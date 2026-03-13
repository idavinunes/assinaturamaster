CREATE TYPE "ServiceCatalogScope" AS ENUM ('GLOBAL', 'TEAM_PRIVATE');

ALTER TABLE "ServiceCatalog"
ADD COLUMN "scope" "ServiceCatalogScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN "ownerTeamId" TEXT;

ALTER TABLE "ServiceCatalog"
ADD CONSTRAINT "ServiceCatalog_ownerTeamId_fkey"
FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceCatalog"
ADD CONSTRAINT "ServiceCatalog_scope_owner_team_check"
CHECK (
  ("scope" = 'GLOBAL' AND "ownerTeamId" IS NULL)
  OR ("scope" = 'TEAM_PRIVATE' AND "ownerTeamId" IS NOT NULL)
);

CREATE UNIQUE INDEX "ServiceCatalog_ownerTeamId_name_key"
ON "ServiceCatalog"("ownerTeamId", "name");

CREATE UNIQUE INDEX "ServiceCatalog_global_name_key"
ON "ServiceCatalog"("name")
WHERE "scope" = 'GLOBAL';

CREATE INDEX "ServiceCatalog_scope_updatedAt_idx"
ON "ServiceCatalog"("scope", "updatedAt");

CREATE INDEX "ServiceCatalog_ownerTeamId_updatedAt_idx"
ON "ServiceCatalog"("ownerTeamId", "updatedAt");
