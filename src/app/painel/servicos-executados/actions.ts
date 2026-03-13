"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildClientScopeWhere,
  buildClientServiceScopeWhere,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { registerUserAudit } from "@/lib/audit";
import { getClientDisplayName } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { buildServiceCatalogScopeWhere } from "@/lib/service-catalog-access";
import {
  createExecutedServiceSchema,
  updateExecutedServiceSchema,
} from "@/lib/validation/forms";

export type ExecutedServiceFormState = {
  error?: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildExecutedServicePayload(formData: FormData) {
  return {
    clientId: String(formData.get("clientId") ?? "").trim(),
    serviceCatalogId: String(formData.get("serviceCatalogId") ?? "").trim(),
    identificationNumber: optionalValue(formData.get("identificationNumber")),
    description: optionalValue(formData.get("description")),
    eventAmount: String(formData.get("eventAmount") ?? "").trim(),
    servicePercentage: String(formData.get("servicePercentage") ?? "").trim(),
  };
}

function getRedirectTarget(formData: FormData) {
  const returnToClientId = optionalValue(formData.get("returnToClientId"));

  if (returnToClientId) {
    return `/painel/clientes/${returnToClientId}/editar`;
  }

  return "/painel/servicos-executados";
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return "Selecione um cliente e um servico validos.";
  }

  return "Nao foi possivel salvar o servico executado.";
}

async function normalizeExecutedServiceData(params: {
  actor: Awaited<ReturnType<typeof requireOperationalWriteAccess>>;
  clientId: string;
  serviceCatalogId: string;
  identificationNumber?: string;
  description?: string;
  eventAmount: string;
  servicePercentage: string;
}) {
  const service = await prisma.serviceCatalog.findFirst({
    where: buildServiceCatalogScopeWhere(params.actor, { id: params.serviceCatalogId }),
    select: {
      description: true,
    },
  });

  if (!service) {
    throw new Error("SERVICE_NOT_FOUND");
  }

  const amount = new Prisma.Decimal(params.eventAmount)
    .mul(params.servicePercentage)
    .div(100)
    .toFixed(2);

  return {
    clientId: params.clientId,
    serviceCatalogId: params.serviceCatalogId,
    identificationNumber: params.identificationNumber || undefined,
    description: params.description || service.description || undefined,
    eventAmount: params.eventAmount,
    servicePercentage: params.servicePercentage,
    amount,
  };
}

async function getScopedClientForExecutedService(
  actor: Awaited<ReturnType<typeof requireOperationalWriteAccess>>,
  clientId: string,
) {
  return prisma.client.findFirst({
    where: buildClientScopeWhere(actor, { id: clientId }),
    select: {
      id: true,
      teamId: true,
      responsibleUserId: true,
      clientType: true,
      legalName: true,
      contactName: true,
    },
  });
}

async function getScopedExecutedServiceForWrite(
  actor: Awaited<ReturnType<typeof requireOperationalWriteAccess>>,
  executedServiceId: string,
) {
  return prisma.clientService.findFirst({
    where: buildClientServiceScopeWhere(actor, { id: executedServiceId }),
    select: {
      id: true,
      clientId: true,
      teamId: true,
      responsibleUserId: true,
      client: {
        select: {
          clientType: true,
          legalName: true,
          contactName: true,
        },
      },
    },
  });
}

async function registerExecutedServiceAudit(params: {
  teamId: string;
  serviceName: string;
  client: {
    clientType: "PERSONAL" | "BUSINESS";
    legalName: string | null;
    contactName: string | null;
  };
  actorUserId: string;
  actorEmail: string;
  action: string;
}) {
  await registerUserAudit({
    actorUserId: params.actorUserId,
    action: params.action,
    description: `Servico executado ${params.serviceName} para ${getClientDisplayName(params.client)} ${params.action === "EXECUTED_SERVICE_CREATED" ? "cadastrado" : "atualizado"} por ${params.actorEmail}.`,
    teamId: params.teamId,
  });
}

export async function createExecutedServiceAction(
  _previousState: ExecutedServiceFormState,
  formData: FormData,
): Promise<ExecutedServiceFormState> {
  const actor = await requireOperationalWriteAccess();
  const parsed = createExecutedServiceSchema.safeParse(buildExecutedServicePayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  try {
    const client = await getScopedClientForExecutedService(actor, parsed.data.clientId);

    if (!client) {
      return { error: "Selecione um cliente valido dentro do seu escopo." };
    }

    const data = await normalizeExecutedServiceData({
      actor,
      ...parsed.data,
    });
    const executedService = await prisma.clientService.create({
      data: {
        clientId: data.clientId,
        serviceCatalogId: data.serviceCatalogId,
        identificationNumber: data.identificationNumber,
        description: data.description,
        eventAmount: data.eventAmount,
        servicePercentage: data.servicePercentage,
        amount: data.amount,
        teamId: client.teamId,
        responsibleUserId: client.responsibleUserId,
      },
      select: {
        id: true,
        teamId: true,
        client: {
          select: {
            clientType: true,
            legalName: true,
            contactName: true,
          },
        },
        serviceCatalog: {
          select: {
            name: true,
          },
        },
      },
    });

    await registerExecutedServiceAudit({
      teamId: executedService.teamId,
      serviceName: executedService.serviceCatalog.name,
      client: executedService.client,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "EXECUTED_SERVICE_CREATED",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SERVICE_NOT_FOUND") {
      return { error: "Selecione um servico valido." };
    }

    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/servicos-executados");

  const redirectTarget = getRedirectTarget(formData);
  revalidatePath(redirectTarget);
  redirect(redirectTarget);
}

export async function updateExecutedServiceAction(
  executedServiceId: string,
  _previousState: ExecutedServiceFormState,
  formData: FormData,
): Promise<ExecutedServiceFormState> {
  const actor = await requireOperationalWriteAccess();
  const parsed = updateExecutedServiceSchema.safeParse(buildExecutedServicePayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  try {
    const existingExecutedService = await getScopedExecutedServiceForWrite(actor, executedServiceId);

    if (!existingExecutedService) {
      return { error: "Servico executado nao encontrado ou fora do seu escopo." };
    }

    const client = await getScopedClientForExecutedService(actor, parsed.data.clientId);

    if (!client) {
      return { error: "Selecione um cliente valido dentro do seu escopo." };
    }

    const data = await normalizeExecutedServiceData({
      actor,
      ...parsed.data,
    });
    const executedService = await prisma.clientService.update({
      where: { id: executedServiceId },
      data: {
        clientId: data.clientId,
        serviceCatalogId: data.serviceCatalogId,
        identificationNumber: data.identificationNumber,
        description: data.description,
        eventAmount: data.eventAmount,
        servicePercentage: data.servicePercentage,
        amount: data.amount,
        teamId: client.teamId,
        responsibleUserId: client.responsibleUserId,
      },
      select: {
        id: true,
        teamId: true,
        client: {
          select: {
            clientType: true,
            legalName: true,
            contactName: true,
          },
        },
        serviceCatalog: {
          select: {
            name: true,
          },
        },
      },
    });

    await registerExecutedServiceAudit({
      teamId: executedService.teamId,
      serviceName: executedService.serviceCatalog.name,
      client: executedService.client,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "EXECUTED_SERVICE_UPDATED",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SERVICE_NOT_FOUND") {
      return { error: "Selecione um servico valido." };
    }

    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/servicos-executados");
  revalidatePath(`/painel/servicos-executados/${executedServiceId}/editar`);

  const redirectTarget = getRedirectTarget(formData);
  revalidatePath(redirectTarget);
  redirect(redirectTarget);
}

export async function deleteExecutedServiceAction(
  executedServiceId: string,
  _previousState: ExecutedServiceFormState,
  formData: FormData,
): Promise<ExecutedServiceFormState> {
  void _previousState;
  const actor = await requireOperationalWriteAccess();

  const executedService = await prisma.clientService.findFirst({
    where: buildClientServiceScopeWhere(actor, { id: executedServiceId }),
    select: {
      id: true,
      clientId: true,
      teamId: true,
      client: {
        select: {
          clientType: true,
          legalName: true,
          contactName: true,
        },
      },
      serviceCatalog: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          signatureRequests: true,
        },
      },
    },
  });

  if (!executedService) {
    return { error: "Servico executado nao encontrado." };
  }

  if (executedService._count.signatureRequests > 0) {
    return {
      error:
        "Este servico executado ja esta vinculado a assinaturas e nao pode ser apagado.",
    };
  }

  try {
    await prisma.clientService.delete({
      where: { id: executedServiceId },
    });
  } catch {
    return { error: "Nao foi possivel apagar o servico executado." };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "EXECUTED_SERVICE_DELETED",
    description: `Servico executado ${executedService.serviceCatalog.name} para ${getClientDisplayName(executedService.client)} apagado por ${actor.email}.`,
    teamId: executedService.teamId,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/servicos-executados");
  revalidatePath("/painel/assinaturas");
  revalidatePath("/painel/assinaturas/novo");
  revalidatePath(`/painel/clientes/${executedService.clientId}/editar`);
  revalidatePath(`/painel/servicos-executados/${executedServiceId}/editar`);

  const redirectTarget = getRedirectTarget(formData);
  revalidatePath(redirectTarget);
  redirect(redirectTarget);
}
