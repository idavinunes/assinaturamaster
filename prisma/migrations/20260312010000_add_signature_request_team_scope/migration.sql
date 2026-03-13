ALTER TABLE "SignatureRequest"
ADD COLUMN "teamId" TEXT,
ADD COLUMN "responsibleUserId" TEXT;

UPDATE "SignatureRequest" AS "signatureRequest"
SET
  "teamId" = "client"."teamId",
  "responsibleUserId" = "client"."responsibleUserId"
FROM "Client" AS "client"
WHERE "signatureRequest"."clientId" = "client"."id";

ALTER TABLE "SignatureRequest"
ALTER COLUMN "teamId" SET NOT NULL;

ALTER TABLE "SignatureRequest"
ADD CONSTRAINT "SignatureRequest_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "SignatureRequest"
ADD CONSTRAINT "SignatureRequest_responsibleUserId_fkey"
FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "SignatureRequest_teamId_status_idx"
ON "SignatureRequest"("teamId", "status");

CREATE INDEX "SignatureRequest_teamId_responsibleUserId_idx"
ON "SignatureRequest"("teamId", "responsibleUserId");

ALTER TABLE "SignedDocument"
ADD COLUMN "teamId" TEXT;

UPDATE "SignedDocument" AS "signedDocument"
SET "teamId" = "signatureRequest"."teamId"
FROM "SignatureRequest" AS "signatureRequest"
WHERE "signedDocument"."signatureRequestId" = "signatureRequest"."id";

ALTER TABLE "SignedDocument"
ALTER COLUMN "teamId" SET NOT NULL;

ALTER TABLE "SignedDocument"
ADD CONSTRAINT "SignedDocument_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "SignedDocument_teamId_generatedAt_idx"
ON "SignedDocument"("teamId", "generatedAt");
