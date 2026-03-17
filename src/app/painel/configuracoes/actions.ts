"use server";

import { revalidatePath } from "next/cache";
import {
  canManageGlobalAdministration,
  canManageTeamBranding,
  requireAccessContext,
} from "@/lib/access-control";
import { registerUserAudit } from "@/lib/audit";
import { BRANDING_SINGLETON_KEY } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import {
  deleteStoredBrandingLogo,
  persistBrandingLogoFile,
} from "@/lib/storage/branding-logos";
import {
  brandingSettingsSchema,
  teamBrandingSettingsSchema,
} from "@/lib/validation/forms";

export type BrandingSettingsFormState = {
  error?: string;
  success?: string;
};

function extractBrandingFormData(formData: FormData) {
  return {
    productName: String(formData.get("productName") ?? ""),
    productShortName: String(formData.get("productShortName") ?? ""),
    productTagline: String(formData.get("productTagline") ?? ""),
    logoPath: String(formData.get("logoPath") ?? ""),
    browserTitle: String(formData.get("browserTitle") ?? ""),
    browserDescription: String(formData.get("browserDescription") ?? ""),
  };
}

async function readBrandingLogoUpload(formData: FormData) {
  const fileEntry = formData.get("logoFile");

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return null;
  }

  return {
    fileName: fileEntry.name,
    mimeType: fileEntry.type,
    fileBytes: new Uint8Array(await fileEntry.arrayBuffer()),
  };
}

function normalizeTeamBrandingFormData(
  values: ReturnType<typeof extractBrandingFormData>,
) {
  return {
    productName: values.productName.trim() || null,
    productShortName: values.productShortName.trim() || null,
    productTagline: values.productTagline.trim() || null,
    logoPath: values.logoPath.trim() || null,
    browserTitle: values.browserTitle.trim() || null,
    browserDescription: values.browserDescription.trim() || null,
  };
}

function revalidateBrandingRoutes() {
  revalidatePath("/", "layout");
  revalidatePath("/painel", "layout");
  revalidatePath("/painel/configuracoes");
  revalidatePath("/entrar");
}

export async function updateBrandingSettingsAction(
  _previousState: BrandingSettingsFormState,
  formData: FormData,
): Promise<BrandingSettingsFormState> {
  const actor = await requireAccessContext();

  if (!canManageGlobalAdministration(actor)) {
    return { error: "Voce nao possui permissao para alterar a marca global." };
  }

  const [logoUpload, existingSettings] = await Promise.all([
    readBrandingLogoUpload(formData),
    prisma.brandingSettings.findUnique({
      where: { singletonKey: BRANDING_SINGLETON_KEY },
      select: { logoPath: true },
    }),
  ]);
  const parsed = brandingSettingsSchema.safeParse(extractBrandingFormData(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const normalizedLogoPath = parsed.data.logoPath.trim();

  if (!normalizedLogoPath && !logoUpload) {
    return { error: "Informe o caminho/URL da logo ou envie um arquivo." };
  }

  try {
    let logoPath = normalizedLogoPath;

    if (logoUpload) {
      const uploadedLogo = await persistBrandingLogoFile({
        scope: "global",
        ...logoUpload,
        previousLogoPath: existingSettings?.logoPath,
      });
      logoPath = uploadedLogo.logoPath;
    } else if (existingSettings?.logoPath && normalizedLogoPath !== existingSettings.logoPath) {
      await deleteStoredBrandingLogo(existingSettings.logoPath);
    }

    await prisma.brandingSettings.upsert({
      where: { singletonKey: BRANDING_SINGLETON_KEY },
      update: {
        ...parsed.data,
        logoPath,
      },
      create: {
        singletonKey: BRANDING_SINGLETON_KEY,
        ...parsed.data,
        logoPath,
      },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Nao foi possivel salvar a logo.",
    };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "BRANDING_SETTINGS_UPDATED",
    description: `Configuracoes de marca global atualizadas por ${actor.email}.`,
  }).catch(() => undefined);

  revalidateBrandingRoutes();

  return { success: "Configuracoes globais atualizadas." };
}

export async function updateActiveTeamBrandingSettingsAction(
  _previousState: BrandingSettingsFormState,
  formData: FormData,
): Promise<BrandingSettingsFormState> {
  const actor = await requireAccessContext();

  if (!actor.activeTeamId || !actor.activeTeam || !canManageTeamBranding(actor)) {
    return { error: "Voce nao possui permissao para alterar a marca desta equipe." };
  }

  const [logoUpload, existingSettings] = await Promise.all([
    readBrandingLogoUpload(formData),
    prisma.teamBrandingSettings.findUnique({
      where: { teamId: actor.activeTeamId },
      select: { logoPath: true },
    }),
  ]);
  const parsed = teamBrandingSettingsSchema.safeParse(extractBrandingFormData(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const data = normalizeTeamBrandingFormData(parsed.data);

  try {
    if (logoUpload) {
      const uploadedLogo = await persistBrandingLogoFile({
        scope: "team",
        teamId: actor.activeTeamId,
        ...logoUpload,
        previousLogoPath: existingSettings?.logoPath,
      });
      data.logoPath = uploadedLogo.logoPath;
    } else if (existingSettings?.logoPath && data.logoPath !== existingSettings.logoPath) {
      await deleteStoredBrandingLogo(existingSettings.logoPath);
    }

    await prisma.teamBrandingSettings.upsert({
      where: { teamId: actor.activeTeamId },
      update: data,
      create: {
        teamId: actor.activeTeamId,
        ...data,
      },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Nao foi possivel salvar a logo.",
    };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_BRANDING_SETTINGS_UPDATED",
    description: `Configuracoes de marca da equipe ${actor.activeTeam.teamName} atualizadas por ${actor.email}.`,
    payload: JSON.stringify({
      teamId: actor.activeTeamId,
    }),
    teamId: actor.activeTeamId,
  }).catch(() => undefined);

  revalidateBrandingRoutes();

  return { success: `Marca da equipe ${actor.activeTeam.teamName} atualizada.` };
}
