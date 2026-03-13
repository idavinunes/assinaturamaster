ALTER TABLE "AuditEvent"
ADD COLUMN "teamId" TEXT;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "AuditEvent_teamId_createdAt_idx"
ON "AuditEvent"("teamId", "createdAt");

CREATE INDEX "ClientService_teamId_updatedAt_idx"
ON "ClientService"("teamId", "updatedAt");

CREATE INDEX "SignatureRequest_teamId_updatedAt_idx"
ON "SignatureRequest"("teamId", "updatedAt");

UPDATE "AuditEvent" AS audit
SET "teamId" = request."teamId"
FROM "SignatureRequest" AS request
WHERE audit."signatureRequestId" = request."id"
  AND audit."teamId" IS NULL;

UPDATE "AuditEvent" AS audit
SET "teamId" = matched."teamId"
FROM (
  SELECT
    id,
    substring(payload from '"teamId":"([^"]+)"') AS "teamId"
  FROM "AuditEvent"
  WHERE "teamId" IS NULL
    AND payload IS NOT NULL
) AS matched
INNER JOIN "Team" AS team
  ON team."id" = matched."teamId"
WHERE audit."id" = matched."id";
