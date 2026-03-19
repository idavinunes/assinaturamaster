CREATE TABLE "ContractTemplateTeamAccess" (
    "templateId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractTemplateTeamAccess_pkey" PRIMARY KEY ("templateId","teamId")
);

CREATE INDEX "ContractTemplateTeamAccess_teamId_idx"
ON "ContractTemplateTeamAccess"("teamId");

ALTER TABLE "ContractTemplateTeamAccess"
ADD CONSTRAINT "ContractTemplateTeamAccess_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractTemplateTeamAccess"
ADD CONSTRAINT "ContractTemplateTeamAccess_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ContractTemplateTeamAccess" ("templateId", "teamId")
SELECT "id", "ownerTeamId"
FROM "ContractTemplate"
WHERE "scope" = 'TEAM_PRIVATE'
  AND "ownerTeamId" IS NOT NULL
ON CONFLICT ("templateId", "teamId") DO NOTHING;
