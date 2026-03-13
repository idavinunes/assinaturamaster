ALTER TABLE "ClientService"
ADD COLUMN "teamId" TEXT,
ADD COLUMN "responsibleUserId" TEXT;

UPDATE "ClientService" AS "clientService"
SET
  "teamId" = "client"."teamId",
  "responsibleUserId" = "client"."responsibleUserId"
FROM "Client" AS "client"
WHERE "clientService"."clientId" = "client"."id";

ALTER TABLE "ClientService"
ALTER COLUMN "teamId" SET NOT NULL;

ALTER TABLE "ClientService"
ADD CONSTRAINT "ClientService_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ClientService"
ADD CONSTRAINT "ClientService_responsibleUserId_fkey"
FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "ClientService_teamId_createdAt_idx"
ON "ClientService"("teamId", "createdAt");

CREATE INDEX "ClientService_teamId_responsibleUserId_idx"
ON "ClientService"("teamId", "responsibleUserId");
