"use server";

import { Prisma, TemplateScope } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerUserAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  canCreateGlobalTemplates,
  canDeleteTemplate,
  canEditTemplate,
  requireTemplateManageContext,
} from "@/lib/template-access";
import {
  deleteTemplateSourceFile,
  persistTemplateSourceFile,
} from "@/lib/storage/template-sources";
import {
  formatTemplateTeamAccessSummary,
  parseTemplateVariablesInput,
  templateScopeLabels,
} from "@/lib/templates";
import { extractTemplateBodyFromSource } from "@/lib/template-rendering";
import { createTemplateSchema, updateTemplateSchema } from "@/lib/validation/forms";

export type TemplateFormState = {
  error?: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildTemplatePayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: optionalValue(formData.get("description")),
    version: String(formData.get("version") ?? "1"),
    body: String(formData.get("body") ?? "").trim(),
    variableSchemaInput: String(formData.get("variableSchemaInput") ?? "").trim(),
    status: String(formData.get("status") ?? "DRAFT"),
    scope: String(formData.get("scope") ?? "TEAM_PRIVATE"),
    allowedTeamIds: formData
      .getAll("allowedTeamIds")
      .map((value) => String(value).trim())
      .filter(Boolean),
  };
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ja existe um modelo com esse nome e essa versao dentro desse escopo.";
  }

  return "Nao foi possivel salvar o modelo.";
}

function parseVariablesOrReturnError(input: string) {
  try {
    return {
      variableSchema: parseTemplateVariablesInput(input),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel interpretar as variaveis do modelo.",
    };
  }
}

async function readTemplateSourceUpload(formData: FormData) {
  const fileEntry = formData.get("sourceFile");

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return null;
  }

  return {
    fileName: fileEntry.name,
    mimeType: fileEntry.type,
    fileBytes: new Uint8Array(await fileEntry.arrayBuffer()),
  };
}

async function resolveTemplateBody(params: {
  bodyInput?: string;
  sourceUpload?: Awaited<ReturnType<typeof readTemplateSourceUpload>>;
  existingBody?: string;
  hasExistingSource?: boolean;
}) {
  if (params.sourceUpload) {
    return extractTemplateBodyFromSource(params.sourceUpload.fileBytes);
  }

  if (params.hasExistingSource) {
    return params.existingBody?.trim() || "Modelo DOCX vinculado ao ONLYOFFICE.";
  }

  const normalizedBody = params.bodyInput?.trim() ?? "";

  if (normalizedBody.length > 0) {
    return normalizedBody;
  }

  throw new Error("Envie um arquivo DOCX no ONLYOFFICE ou informe o conteudo base do contrato.");
}

type TemplateScopeResolution = {
  scope: TemplateScope;
  ownerTeamId: string | null;
  ownerTeamName: string | null;
  allowedTeams: Array<{
    id: string;
    name: string;
  }>;
};

function describeTemplateScope(
  scope: TemplateScope,
  ownerTeamName?: string | null,
  allowedTeamNames: string[] = [],
) {
  if (scope === TemplateScope.GLOBAL) {
    return templateScopeLabels.GLOBAL.toLowerCase();
  }

  if (allowedTeamNames.length > 0) {
    return `${templateScopeLabels.TEAM_PRIVATE.toLowerCase()} (${formatTemplateTeamAccessSummary(allowedTeamNames)})`;
  }

  return ownerTeamName
    ? `${templateScopeLabels.TEAM_PRIVATE.toLowerCase()} de ${ownerTeamName}`
    : templateScopeLabels.TEAM_PRIVATE.toLowerCase();
}

function buildTemplateDuplicateWhere(params: {
  name: string;
  version: number;
  scope: TemplateScope;
  ownerTeamId: string | null;
  allowedTeamIds: string[];
  excludeTemplateId?: string;
}) {
  const baseWhere: Prisma.ContractTemplateWhereInput =
    params.scope === TemplateScope.GLOBAL
      ? {
          scope: TemplateScope.GLOBAL,
          name: params.name,
          version: params.version,
        }
      : {
          scope: TemplateScope.TEAM_PRIVATE,
          name: params.name,
          version: params.version,
          teamAccesses: {
            some: {
              teamId: {
                in: params.allowedTeamIds,
              },
            },
          },
        };

  if (!params.excludeTemplateId) {
    return baseWhere;
  }

  return {
    AND: [
      baseWhere,
      {
        id: {
          not: params.excludeTemplateId,
        },
      },
    ],
  } satisfies Prisma.ContractTemplateWhereInput;
}

async function ensureTemplateUniqueness(params: {
  name: string;
  version: number;
  scope: TemplateScope;
  ownerTeamId: string | null;
  allowedTeamIds: string[];
  excludeTemplateId?: string;
}) {
  const existingTemplate = await prisma.contractTemplate.findFirst({
    where: buildTemplateDuplicateWhere(params),
    select: {
      id: true,
    },
  });

  if (existingTemplate) {
    throw new Error("Ja existe um modelo com esse nome e essa versao dentro desse escopo.");
  }
}

async function resolveOwnerTeam(params: {
  actor: Awaited<ReturnType<typeof requireTemplateManageContext>>;
  currentTemplate?: {
    scope: TemplateScope;
    ownerTeamId: string | null;
  };
}) {
  if (
    params.actor.globalRole === "SUPER_ADMIN" &&
    params.currentTemplate?.scope === TemplateScope.TEAM_PRIVATE &&
    params.currentTemplate.ownerTeamId &&
    (!params.actor.activeTeamId || params.currentTemplate.ownerTeamId !== params.actor.activeTeamId)
  ) {
    const ownerTeam = await prisma.team.findUnique({
      where: { id: params.currentTemplate.ownerTeamId },
      select: {
        id: true,
        name: true,
      },
    });

    if (ownerTeam) {
      return ownerTeam;
    }
  }

  if (!params.actor.activeTeamId || !params.actor.activeTeam) {
    throw new Error("Selecione uma equipe ativa para usar um modelo restrito.");
  }

  return {
    id: params.actor.activeTeamId,
    name: params.actor.activeTeam.teamName,
  };
}

function normalizeTeamIds(teamIds: string[]) {
  return [...new Set(teamIds.map((teamId) => teamId.trim()).filter(Boolean))];
}

async function resolveTemplateScope(params: {
  actor: Awaited<ReturnType<typeof requireTemplateManageContext>>;
  desiredScope: TemplateScope;
  selectedTeamIds: string[];
  currentTemplate?: {
    scope: TemplateScope;
    ownerTeamId: string | null;
  };
}): Promise<TemplateScopeResolution> {
  if (params.desiredScope === TemplateScope.GLOBAL) {
    if (!canCreateGlobalTemplates(params.actor)) {
      throw new Error("Apenas o super admin pode criar ou manter modelos globais.");
    }

    return {
      scope: TemplateScope.GLOBAL,
      ownerTeamId: null,
      ownerTeamName: null,
      allowedTeams: [],
    };
  }

  const ownerTeam = await resolveOwnerTeam({
    actor: params.actor,
    currentTemplate: params.currentTemplate,
  });

  if (!canCreateGlobalTemplates(params.actor)) {
    return {
      scope: TemplateScope.TEAM_PRIVATE,
      ownerTeamId: ownerTeam.id,
      ownerTeamName: ownerTeam.name,
      allowedTeams: [ownerTeam],
    };
  }

  const candidateTeamIds = normalizeTeamIds([ownerTeam.id, ...params.selectedTeamIds]);
  const teams = await prisma.team.findMany({
    where: {
      id: {
        in: candidateTeamIds,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (teams.length !== candidateTeamIds.length) {
    throw new Error("Uma ou mais equipes selecionadas nao existem mais.");
  }

  const teamsById = new Map(teams.map((team) => [team.id, team] as const));
  const allowedTeams = candidateTeamIds.map((teamId) => teamsById.get(teamId)!);

  return {
    scope: TemplateScope.TEAM_PRIVATE,
    ownerTeamId: ownerTeam.id,
    ownerTeamName: ownerTeam.name,
    allowedTeams,
  };
}

export async function createTemplateAction(
  _previousState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const actor = await requireTemplateManageContext();
  const payload = buildTemplatePayload(formData);
  const parsed = createTemplateSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const variableResult = parseVariablesOrReturnError(parsed.data.variableSchemaInput ?? "");

  if ("error" in variableResult) {
    return { error: variableResult.error };
  }

  let templateScope: TemplateScopeResolution;

  try {
    templateScope = await resolveTemplateScope({
      actor,
      desiredScope: parsed.data.scope,
      selectedTeamIds: parsed.data.allowedTeamIds ?? [],
    });
    await ensureTemplateUniqueness({
      name: parsed.data.name,
      version: parsed.data.version,
      scope: templateScope.scope,
      ownerTeamId: templateScope.ownerTeamId,
      allowedTeamIds: templateScope.allowedTeams.map((team) => team.id),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel definir o escopo do modelo.",
    };
  }

  const sourceUpload = await readTemplateSourceUpload(formData);
  let resolvedBody: string;

  try {
    resolvedBody = await resolveTemplateBody({
      bodyInput: parsed.data.body,
      sourceUpload,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel preparar o conteudo do modelo.",
    };
  }

  let template:
    | {
        id: string;
        name: string;
        version: number;
        sourceStoragePath: string | null;
      }
    | undefined;

  try {
    template = await prisma.$transaction(async (tx) => {
      const createdTemplate = await tx.contractTemplate.create({
        data: {
          scope: templateScope.scope,
          ownerTeamId: templateScope.ownerTeamId,
          name: parsed.data.name,
          description: parsed.data.description,
          version: parsed.data.version,
          body: resolvedBody,
          variableSchema: variableResult.variableSchema,
          status: parsed.data.status,
        },
        select: {
          id: true,
          name: true,
          version: true,
          sourceStoragePath: true,
        },
      });

      if (templateScope.scope === TemplateScope.TEAM_PRIVATE) {
        await tx.contractTemplateTeamAccess.createMany({
          data: templateScope.allowedTeams.map((team) => ({
            templateId: createdTemplate.id,
            teamId: team.id,
          })),
        });
      }

      return createdTemplate;
    });
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  if (sourceUpload) {
    try {
      const storedSource = await persistTemplateSourceFile({
        templateId: template.id,
        fileName: sourceUpload.fileName,
        fileBytes: sourceUpload.fileBytes,
        mimeType: sourceUpload.mimeType,
        previousStoragePath: template.sourceStoragePath,
      });

      await prisma.contractTemplate.update({
        where: { id: template.id },
        data: {
          sourceFileName: storedSource.fileName,
          sourceMimeType: storedSource.mimeType,
          sourceStoragePath: storedSource.storagePath,
        },
      });
    } catch (error) {
      await prisma.contractTemplate.delete({
        where: { id: template.id },
      }).catch(() => undefined);

      return {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o DOCX do modelo.",
      };
    }
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEMPLATE_CREATED",
    description: `Modelo ${template.name} v${template.version} (${describeTemplateScope(
      templateScope.scope,
      templateScope.ownerTeamName,
      templateScope.allowedTeams.map((team) => team.name),
    )}) criado por ${actor.email}.`,
    teamId: templateScope.ownerTeamId,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/modelos");
  if (sourceUpload) {
    redirect(`/editor/modelos/${template.id}`);
  }

  redirect(`/painel/modelos/${template.id}/editar`);
}

export async function updateTemplateAction(
  templateId: string,
  _previousState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const actor = await requireTemplateManageContext();
  const payload = buildTemplatePayload(formData);
  const parsed = updateTemplateSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const variableResult = parseVariablesOrReturnError(parsed.data.variableSchemaInput ?? "");

  if ("error" in variableResult) {
    return { error: variableResult.error };
  }

  const sourceUpload = await readTemplateSourceUpload(formData);
  const currentTemplate = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      body: true,
      scope: true,
      ownerTeamId: true,
      sourceStoragePath: true,
    },
  });

  if (!currentTemplate) {
    return { error: "Modelo nao encontrado." };
  }

  if (
    !canEditTemplate(actor, {
      scope: currentTemplate.scope,
      ownerTeamId: currentTemplate.ownerTeamId,
    })
  ) {
    return {
      error:
        currentTemplate.scope === TemplateScope.GLOBAL
          ? "Modelos globais podem ser alterados apenas pelo super admin."
          : "Este modelo nao pertence a equipe ativa.",
    };
  }

  let templateScope: TemplateScopeResolution;

  try {
    templateScope = await resolveTemplateScope({
      actor,
      desiredScope: parsed.data.scope,
      selectedTeamIds: parsed.data.allowedTeamIds ?? [],
      currentTemplate,
    });
    await ensureTemplateUniqueness({
      name: parsed.data.name,
      version: parsed.data.version,
      scope: templateScope.scope,
      ownerTeamId: templateScope.ownerTeamId,
      allowedTeamIds: templateScope.allowedTeams.map((team) => team.id),
      excludeTemplateId: templateId,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel definir o escopo do modelo.",
    };
  }

  let resolvedBody: string;

  try {
    resolvedBody = await resolveTemplateBody({
      bodyInput: parsed.data.body,
      sourceUpload,
      existingBody: currentTemplate.body,
      hasExistingSource: Boolean(currentTemplate.sourceStoragePath),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel preparar o conteudo do modelo.",
    };
  }

  let template:
    | {
        id: string;
        name: string;
        version: number;
        sourceStoragePath: string | null;
      }
    | undefined;

  try {
    template = await prisma.$transaction(async (tx) => {
      const updatedTemplate = await tx.contractTemplate.update({
        where: { id: templateId },
        data: {
          scope: templateScope.scope,
          ownerTeamId: templateScope.ownerTeamId,
          name: parsed.data.name,
          description: parsed.data.description,
          version: parsed.data.version,
          body: resolvedBody,
          variableSchema: variableResult.variableSchema,
          status: parsed.data.status,
        },
        select: {
          id: true,
          name: true,
          version: true,
          sourceStoragePath: true,
        },
      });

      await tx.contractTemplateTeamAccess.deleteMany({
        where: {
          templateId,
        },
      });

      if (templateScope.scope === TemplateScope.TEAM_PRIVATE) {
        await tx.contractTemplateTeamAccess.createMany({
          data: templateScope.allowedTeams.map((team) => ({
            templateId,
            teamId: team.id,
          })),
        });
      }

      return updatedTemplate;
    });
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  if (sourceUpload) {
    try {
      const storedSource = await persistTemplateSourceFile({
        templateId: template.id,
        fileName: sourceUpload.fileName,
        fileBytes: sourceUpload.fileBytes,
        mimeType: sourceUpload.mimeType,
        previousStoragePath: template.sourceStoragePath,
      });

      await prisma.contractTemplate.update({
        where: { id: template.id },
        data: {
          sourceFileName: storedSource.fileName,
          sourceMimeType: storedSource.mimeType,
          sourceStoragePath: storedSource.storagePath,
        },
      });
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o DOCX do modelo.",
      };
    }
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEMPLATE_UPDATED",
    description: `Modelo ${template.name} v${template.version} (${describeTemplateScope(
      templateScope.scope,
      templateScope.ownerTeamName,
      templateScope.allowedTeams.map((team) => team.name),
    )}) atualizado por ${actor.email}.`,
    teamId: templateScope.ownerTeamId,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/modelos");
  revalidatePath(`/painel/modelos/${templateId}/editar`);
  revalidatePath(`/painel/modelos/${templateId}/editor`);
  revalidatePath(`/editor/modelos/${templateId}`);

  if (sourceUpload) {
    redirect(`/editor/modelos/${templateId}`);
  }

  redirect(`/painel/modelos/${templateId}/editar`);
}

export async function deleteTemplateAction(
  templateId: string,
  _previousState: TemplateFormState,
): Promise<TemplateFormState> {
  void _previousState;
  const actor = await requireTemplateManageContext();

  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      version: true,
      scope: true,
      ownerTeamId: true,
      ownerTeam: {
        select: {
          name: true,
        },
      },
      teamAccesses: {
        select: {
          team: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          team: {
            name: "asc",
          },
        },
      },
      sourceStoragePath: true,
      _count: {
        select: {
          signatureRequests: true,
        },
      },
    },
  });

  if (!template) {
    return { error: "Modelo nao encontrado." };
  }

  if (
    !canDeleteTemplate(actor, {
      scope: template.scope,
      ownerTeamId: template.ownerTeamId,
    })
  ) {
    return { error: "A exclusao de modelos continua restrita ao super admin." };
  }

  if (template._count.signatureRequests > 0) {
    return {
      error:
        "Este modelo ja esta vinculado a solicitacoes de assinatura e nao pode ser apagado.",
    };
  }

  try {
    await prisma.contractTemplate.delete({
      where: { id: templateId },
    });
  } catch {
    return { error: "Nao foi possivel apagar o modelo." };
  }

  await deleteTemplateSourceFile(template.sourceStoragePath).catch(() => undefined);

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEMPLATE_DELETED",
    description: `Modelo ${template.name} v${template.version} (${describeTemplateScope(
      template.scope,
      template.ownerTeam?.name,
      template.teamAccesses.map((access) => access.team.name),
    )}) apagado por ${actor.email}.`,
    teamId: template.ownerTeamId,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/modelos");
  revalidatePath("/painel/assinaturas");
  revalidatePath("/painel/assinaturas/novo");
  revalidatePath(`/painel/modelos/${templateId}/editar`);
  revalidatePath(`/painel/modelos/${templateId}/editor`);
  revalidatePath(`/editor/modelos/${templateId}`);

  redirect("/painel/modelos");
}
