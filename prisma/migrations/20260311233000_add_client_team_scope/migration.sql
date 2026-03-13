ALTER TABLE "Client"
ADD COLUMN "teamId" TEXT,
ADD COLUMN "responsibleUserId" TEXT;

UPDATE "Client"
SET "teamId" = (
  SELECT "id"
  FROM "Team"
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
)
WHERE "teamId" IS NULL;

ALTER TABLE "Client"
ALTER COLUMN "teamId" SET NOT NULL;

DROP INDEX IF EXISTS "Client_documentNumber_key";

ALTER TABLE "Client"
ADD CONSTRAINT "Client_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Client"
ADD CONSTRAINT "Client_responsibleUserId_fkey"
FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Client_teamId_documentNumber_key"
ON "Client"("teamId", "documentNumber");

CREATE INDEX "Client_teamId_updatedAt_idx"
ON "Client"("teamId", "updatedAt");

CREATE INDEX "Client_teamId_responsibleUserId_idx"
ON "Client"("teamId", "responsibleUserId");

CREATE INDEX "Client_teamId_legalName_idx"
ON "Client"("teamId", "legalName");
