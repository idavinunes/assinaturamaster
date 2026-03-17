DROP INDEX "SignatureRequest_serviceId_idx";

CREATE UNIQUE INDEX "SignatureRequest_serviceId_key" ON "SignatureRequest"("serviceId");
