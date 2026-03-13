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
import { parseTemplateVariablesInput, templateScopeLabels } from "@/lib/templates";
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
};

function describeTemplateScope(scope: TemplateScope, ownerTeamName?: string | null) {
  if (scope === TemplateScope.GLOBAL) {
    return templateScopeLabels.GLOBAL.toLowerCase();
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
          ownerTeamId: params.ownerTeamId,
          name: params.name,
          version: params.version,
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

async function resolveTemplateScope(params: {
  actor: Awaited<ReturnType<typeof requireTemplateManageContext>>;
  desiredScope: TemplateScope;
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
    };
  }

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
      return {
        scope: TemplateScope.TEAM_PRIVATE,
        ownerTeamId: ownerTeam.id,
        ownerTeamName: ownerTeam.name,
      };
    }
  }

  if (!params.actor.activeTeamId || !params.actor.activeTeam) {
    throw new Error("Selecione uma equipe ativa para usar modelo privado da equipe.");
  }

  return {
    scope: TemplateScope.TEAM_PRIVATE,
    ownerTeamId: params.actor.activeTeamId,
    ownerTeamName: params.actor.activeTeam.teamName,
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
    });
    await ensureTemplateUniqueness({
      name: parsed.data.name,
      version: parsed.data.version,
      scope: templateScope.scope,
      ownerTeamId: templateScope.ownerTeamId,
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
    template = await prisma.contractTemplate.create({
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
    description: `Modelo ${template.name} v${template.version} (${describeTemplateScope(templateScope.scope, templateScope.ownerTeamName)}) criado por ${actor.email}.`,
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
      currentTemplate,
    });
    await ensureTemplateUniqueness({
      name: parsed.data.name,
      version: parsed.data.version,
      scope: templateScope.scope,
      ownerTeamId: templateScope.ownerTeamId,
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
    template = await prisma.contractTemplate.update({
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
    description: `Modelo ${template.name} v${template.version} (${describeTemplateScope(templateScope.scope, templateScope.ownerTeamName)}) atualizado por ${actor.email}.`,
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
    description: `Modelo ${template.name} v${template.version} (${describeTemplateScope(template.scope, template.ownerTeam?.name)}) apagado por ${actor.email}.`,
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
