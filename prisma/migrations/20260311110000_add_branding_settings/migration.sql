-- CreateTable
CREATE TABLE "BrandingSettings" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "productName" TEXT NOT NULL DEFAULT 'Assinaura Contrato',
    "productShortName" TEXT NOT NULL DEFAULT 'Assinaura',
    "productTagline" TEXT NOT NULL DEFAULT 'Assinatura e evidencia',
    "logoPath" TEXT NOT NULL DEFAULT '/brand-logo.svg',
    "browserTitle" TEXT NOT NULL DEFAULT 'Assinaura Contrato',
    "browserDescription" TEXT NOT NULL DEFAULT 'MVP para formalizacao de documentos com selfie, GPS, IP, trilha de auditoria e PDF assinado.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandingSettings_singletonKey_key" ON "BrandingSettings"("singletonKey");
