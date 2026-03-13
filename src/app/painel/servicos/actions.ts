"use server";

import { Prisma, ServiceCatalogScope } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerUserAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { serviceCatalogScopeLabels } from "@/lib/service-catalog";
import {
  buildServiceCatalogScopeWhere,
  canEditServiceCatalog,
  canCreateGlobalServiceCatalog,
  requireServiceCatalogManageContext,
} from "@/lib/service-catalog-access";
import {
  createServiceCatalogSchema,
  updateServiceCatalogSchema,
} from "@/lib/validation/forms";

export type ServiceCatalogFormState = {
  error?: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildServiceCatalogPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: optionalValue(formData.get("description")),
    eventAmount: String(formData.get("eventAmount") ?? "").trim(),
    defaultPercentage: String(formData.get("defaultPercentage") ?? "").trim(),
    scope: String(formData.get("scope") ?? "TEAM_PRIVATE"),
  };
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ja existe um servico com esse nome dentro desse escopo.";
  }

  return "Nao foi possivel salvar o servico.";
}

type ServiceCatalogScopeResolution = {
  scope: ServiceCatalogScope;
  ownerTeamId: string | null;
  ownerTeamName: string | null;
};

function describeServiceCatalogScope(
  scope: ServiceCatalogScope,
  ownerTeamName?: string | null,
) {
  if (scope === ServiceCatalogScope.GLOBAL) {
    return serviceCatalogScopeLabels.GLOBAL.toLowerCase();
  }

  return ownerTeamName
    ? `${serviceCatalogScopeLabels.TEAM_PRIVATE.toLowerCase()} de ${ownerTeamName}`
    : serviceCatalogScopeLabels.TEAM_PRIVATE.toLowerCase();
}

function buildServiceCatalogDuplicateWhere(params: {
  name: string;
  scope: ServiceCatalogScope;
  ownerTeamId: string | null;
  excludeServiceCatalogId?: string;
}) {
  const baseWhere: Prisma.ServiceCatalogWhereInput =
    params.scope === ServiceCatalogScope.GLOBAL
      ? {
          scope: ServiceCatalogScope.GLOBAL,
          name: params.name,
        }
      : {
          scope: ServiceCatalogScope.TEAM_PRIVATE,
          ownerTeamId: params.ownerTeamId,
          name: params.name,
        };

  if (!params.excludeServiceCatalogId) {
    return baseWhere;
  }

  return {
    AND: [
      baseWhere,
      {
        id: {
          not: params.excludeServiceCatalogId,
        },
      },
    ],
  } satisfies Prisma.ServiceCatalogWhereInput;
}

async function ensureServiceCatalogUniqueness(params: {
  name: string;
  scope: ServiceCatalogScope;
  ownerTeamId: string | null;
  excludeServiceCatalogId?: string;
}) {
  const existingService = await prisma.serviceCatalog.findFirst({
    where: buildServiceCatalogDuplicateWhere(params),
    select: {
      id: true,
    },
  });

  if (existingService) {
    throw new Error("Ja existe um servico com esse nome dentro desse escopo.");
  }
}

async function resolveServiceCatalogScope(params: {
  actor: Awaited<ReturnType<typeof requireServiceCatalogManageContext>>;
  desiredScope: ServiceCatalogScope;
  currentService?: {
    scope: ServiceCatalogScope;
    ownerTeamId: string | null;
  };
}): Promise<ServiceCatalogScopeResolution> {
  if (params.desiredScope === ServiceCatalogScope.GLOBAL) {
    if (!canCreateGlobalServiceCatalog(params.actor)) {
      throw new Error("Apenas o super admin pode criar ou manter servicos globais.");
    }

    return {
      scope: ServiceCatalogScope.GLOBAL,
      ownerTeamId: null,
      ownerTeamName: null,
    };
  }

  if (
    params.actor.globalRole === "SUPER_ADMIN" &&
    params.currentService?.scope === ServiceCatalogScope.TEAM_PRIVATE &&
    params.currentService.ownerTeamId &&
    (!params.actor.activeTeamId || params.currentService.ownerTeamId !== params.actor.activeTeamId)
  ) {
    const ownerTeam = await prisma.team.findUnique({
      where: { id: params.currentService.ownerTeamId },
      select: {
        id: true,
        name: true,
      },
    });

    if (ownerTeam) {
      return {
        scope: ServiceCatalogScope.TEAM_PRIVATE,
        ownerTeamId: ownerTeam.id,
        ownerTeamName: ownerTeam.name,
      };
    }
  }

  if (!params.actor.activeTeamId || !params.actor.activeTeam) {
    throw new Error("Selecione uma equipe ativa para usar servicos privados da equipe.");
  }

  return {
    scope: ServiceCatalogScope.TEAM_PRIVATE,
    ownerTeamId: params.actor.activeTeamId,
    ownerTeamName: params.actor.activeTeam.teamName,
  };
}

export async function createServiceCatalogAction(
  _previousState: ServiceCatalogFormState,
  formData: FormData,
): Promise<ServiceCatalogFormState> {
  const actor = await requireServiceCatalogManageContext();
  const parsed = createServiceCatalogSchema.safeParse(buildServiceCatalogPayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  let serviceScope: ServiceCatalogScopeResolution;

  try {
    serviceScope = await resolveServiceCatalogScope({
      actor,
      desiredScope: parsed.data.scope,
    });

    await ensureServiceCatalogUniqueness({
      name: parsed.data.name,
      scope: serviceScope.scope,
      ownerTeamId: serviceScope.ownerTeamId,
    });

    const service = await prisma.serviceCatalog.create({
      data: {
        scope: serviceScope.scope,
        ownerTeamId: serviceScope.ownerTeamId,
        name: parsed.data.name,
        description: parsed.data.description,
        defaultAmount: parsed.data.eventAmount,
        defaultPercentage: parsed.data.defaultPercentage,
      },
      select: {
        id: true,
        name: true,
        scope: true,
        ownerTeamId: true,
      },
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "SERVICE_CATALOG_CREATED",
      description: `Servico ${service.name} (${describeServiceCatalogScope(service.scope, serviceScope.ownerTeamName)}) cadastrado por ${actor.email}.`,
      teamId: service.ownerTeamId ?? undefined,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : getPrismaErrorMessage(error),
    };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/servicos-executados");
  redirect("/painel/servicos");
}

export async function updateServiceCatalogAction(
  serviceCatalogId: string,
  _previousState: ServiceCatalogFormState,
  formData: FormData,
): Promise<ServiceCatalogFormState> {
  const actor = await requireServiceCatalogManageContext();
  const parsed = updateServiceCatalogSchema.safeParse({
    ...buildServiceCatalogPayload(formData),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  let serviceScope: ServiceCatalogScopeResolution;

  try {
    const existingService = await prisma.serviceCatalog.findFirst({
      where: buildServiceCatalogScopeWhere(actor, { id: serviceCatalogId }),
      select: {
        id: true,
        scope: true,
        ownerTeamId: true,
      },
    });

    if (!existingService) {
      return { error: "Servico nao encontrado." };
    }

    if (!canEditServiceCatalog(actor, existingService)) {
      return { error: "Servico fora do seu contexto atual." };
    }

    serviceScope = await resolveServiceCatalogScope({
      actor,
      desiredScope: parsed.data.scope,
      currentService: existingService,
    });

    await ensureServiceCatalogUniqueness({
      name: parsed.data.name,
      scope: serviceScope.scope,
      ownerTeamId: serviceScope.ownerTeamId,
      excludeServiceCatalogId: serviceCatalogId,
    });

    const service = await prisma.serviceCatalog.update({
      where: { id: serviceCatalogId },
      data: {
        scope: serviceScope.scope,
        ownerTeamId: serviceScope.ownerTeamId,
        name: parsed.data.name,
        description: parsed.data.description,
        defaultAmount: parsed.data.eventAmount,
        defaultPercentage: parsed.data.defaultPercentage,
        isActive: parsed.data.isActive,
      },
      select: {
        id: true,
        name: true,
        scope: true,
        ownerTeamId: true,
      },
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "SERVICE_CATALOG_UPDATED",
      description: `Servico ${service.name} (${describeServiceCatalogScope(service.scope, serviceScope.ownerTeamName)}) atualizado por ${actor.email}.`,
      teamId: service.ownerTeamId ?? undefined,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : getPrismaErrorMessage(error),
    };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/servicos-executados");
  revalidatePath(`/painel/servicos/${serviceCatalogId}/editar`);
  redirect("/painel/servicos");
}
