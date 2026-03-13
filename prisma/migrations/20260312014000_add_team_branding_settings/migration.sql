CREATE TABLE "TeamBrandingSettings" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "productName" TEXT,
  "productShortName" TEXT,
  "productTagline" TEXT,
  "logoPath" TEXT,
  "browserTitle" TEXT,
  "browserDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamBrandingSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamBrandingSettings_teamId_key"
ON "TeamBrandingSettings"("teamId");

ALTER TABLE "TeamBrandingSettings"
ADD CONSTRAINT "TeamBrandingSettings_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
