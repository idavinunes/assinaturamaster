import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const BRANDING_SINGLETON_KEY = "default";

export const defaultBrandingSettings = {
  productName: "Assinaura Contrato",
  productShortName: "Assinaura",
  productTagline: "Assinatura e evidencia",
  logoPath: "/brand-logo.svg",
  browserTitle: "Assinaura Contrato",
  browserDescription:
    "MVP para formalizacao de documentos com selfie, GPS, IP, trilha de auditoria e PDF assinado.",
};

export type BrandingSettingsValues = typeof defaultBrandingSettings;

export type TeamBrandingSettingsValues = {
  [Key in keyof BrandingSettingsValues]: string | null;
};

export const emptyTeamBrandingSettings: TeamBrandingSettingsValues = {
  productName: null,
  productShortName: null,
  productTagline: null,
  logoPath: null,
  browserTitle: null,
  browserDescription: null,
};

const brandingFieldSelect = {
  productName: true,
  productShortName: true,
  productTagline: true,
  logoPath: true,
  browserTitle: true,
  browserDescription: true,
} as const;

function normalizeGlobalBranding(
  value: Partial<BrandingSettingsValues> | null | undefined,
): BrandingSettingsValues {
  return {
    productName: value?.productName ?? defaultBrandingSettings.productName,
    productShortName: value?.productShortName ?? defaultBrandingSettings.productShortName,
    productTagline: value?.productTagline ?? defaultBrandingSettings.productTagline,
    logoPath: value?.logoPath ?? defaultBrandingSettings.logoPath,
    browserTitle: value?.browserTitle ?? defaultBrandingSettings.browserTitle,
    browserDescription:
      value?.browserDescription ?? defaultBrandingSettings.browserDescription,
  };
}

function normalizeTeamBranding(
  value: Partial<TeamBrandingSettingsValues> | null | undefined,
): TeamBrandingSettingsValues {
  return {
    productName: value?.productName ?? null,
    productShortName: value?.productShortName ?? null,
    productTagline: value?.productTagline ?? null,
    logoPath: value?.logoPath ?? null,
    browserTitle: value?.browserTitle ?? null,
    browserDescription: value?.browserDescription ?? null,
  };
}

function resolveBrandingValues(
  globalBranding: BrandingSettingsValues,
  teamBranding: TeamBrandingSettingsValues | null,
): BrandingSettingsValues {
  if (!teamBranding) {
    return globalBranding;
  }

  return {
    productName: teamBranding.productName ?? globalBranding.productName,
    productShortName:
      teamBranding.productShortName ?? globalBranding.productShortName,
    productTagline: teamBranding.productTagline ?? globalBranding.productTagline,
    logoPath: teamBranding.logoPath ?? globalBranding.logoPath,
    browserTitle: teamBranding.browserTitle ?? globalBranding.browserTitle,
    browserDescription:
      teamBranding.browserDescription ?? globalBranding.browserDescription,
  };
}

export const getGlobalBrandingSettings = cache(async (): Promise<BrandingSettingsValues> => {
  try {
    const settings = await prisma.brandingSettings.findUnique({
      where: { singletonKey: BRANDING_SINGLETON_KEY },
      select: brandingFieldSelect,
    });

    return normalizeGlobalBranding(settings);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Global branding settings fallback applied.", error);
    }

    return defaultBrandingSettings;
  }
});

export const getTeamBrandingSettings = cache(
  async (teamId: string): Promise<TeamBrandingSettingsValues | null> => {
    try {
      const settings = await prisma.teamBrandingSettings.findUnique({
        where: { teamId },
        select: brandingFieldSelect,
      });

      return settings ? normalizeTeamBranding(settings) : null;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Team branding settings fallback applied.", error);
      }

      return null;
    }
  },
);

export const getResolvedBrandingSettings = cache(
  async (teamId: string | null = null): Promise<BrandingSettingsValues> => {
    const globalBranding = await getGlobalBrandingSettings();

    if (!teamId) {
      return globalBranding;
    }

    const teamBranding = await getTeamBrandingSettings(teamId);
    return resolveBrandingValues(globalBranding, teamBranding);
  },
);

export const getBrandingSettings = getGlobalBrandingSettings;
