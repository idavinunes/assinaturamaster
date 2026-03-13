ALTER TABLE "ContractTemplate"
ADD CONSTRAINT "ContractTemplate_scope_owner_team_check"
CHECK (
  ("scope" = 'GLOBAL' AND "ownerTeamId" IS NULL)
  OR ("scope" = 'TEAM_PRIVATE' AND "ownerTeamId" IS NOT NULL)
);

CREATE UNIQUE INDEX "ContractTemplate_global_name_version_key"
ON "ContractTemplate"("name", "version")
WHERE "scope" = 'GLOBAL';
