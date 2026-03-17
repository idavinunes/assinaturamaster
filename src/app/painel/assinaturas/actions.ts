"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildClientScopeWhere,
  buildClientServiceScopeWhere,
  buildSignatureRequestScopeWhere,
  canDeleteSignedSignatureRequests,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { registerUserAudit } from "@/lib/audit";
import { getClientDisplayName } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import { deleteStoredEvidenceFile } from "@/lib/storage/signature-evidence";
import { deleteSignedContractPdf } from "@/lib/storage/signed-documents";
import { buildTemplateScopeWhere } from "@/lib/template-access";
import {
  createSignatureRequestSchema,
  updateSignatureRequestSchema,
} from "@/lib/validation/forms";

export type SignatureRequestFormState = {
  error?: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildSignatureRequestPayload(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    clientId: String(formData.get("clientId") ?? "").trim(),
    serviceId: String(formData.get("serviceId") ?? "").trim(),
    templateId: String(formData.get("templateId") ?? "").trim(),
    signerName: String(formData.get("signerName") ?? "").trim(),
    signerEmail: String(formData.get("signerEmail") ?? "").trim(),
    signerDocument: optionalValue(formData.get("signerDocument")),
    signerPhone: optionalValue(formData.get("signerPhone")),
    status: String(formData.get("status") ?? "DRAFT").trim(),
    expiresAt: optionalValue(formData.get("expiresAt")),
  };
}

function endOfDayFromDateInput(value?: string) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(`${value}T23:59:59.999`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

async function validateRequestRelations(params: {
  actor: Awaited<ReturnType<typeof requireOperationalWriteAccess>>;
  clientId: string;
  serviceId: string;
  templateId: string;
  currentRequestId?: string;
}) {
  const [client, service, template, conflictingRequest] = await Promise.all([
    prisma.client.findFirst({
      where: buildClientScopeWhere(params.actor, {
        id: params.clientId,
      }),
      select: {
        id: true,
        teamId: true,
        responsibleUserId: true,
        clientType: true,
        legalName: true,
        contactName: true,
      },
    }),
    prisma.clientService.findFirst({
      where: buildClientServiceScopeWhere(params.actor, {
        id: params.serviceId,
      }),
      select: {
        id: true,
        clientId: true,
        teamId: true,
        serviceCatalog: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.contractTemplate.findFirst({
      where: buildTemplateScopeWhere(params.actor, {
        id: params.templateId,
      }),
      select: {
        id: true,
        status: true,
      },
    }),
    prisma.signatureRequest.findFirst({
      where: {
        serviceId: params.serviceId,
        ...(params.currentRequestId
          ? {
              id: {
                not: params.currentRequestId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!client) {
    return { error: "Selecione um cliente valido dentro do seu escopo." };
  }

  if (!service) {
    return { error: "Selecione um servico executado valido." };
  }

  if (service.clientId !== client.id) {
    return { error: "O servico executado precisa pertencer ao cliente selecionado." };
  }

  if (service.teamId !== client.teamId) {
    return { error: "Cliente e servico executado precisam pertencer a mesma equipe." };
  }

  if (conflictingRequest) {
    return {
      error: "Este servico executado ja esta vinculado a outra solicitacao de assinatura.",
    };
  }

  if (!template) {
    return { error: "Selecione um modelo valido." };
  }

  if (template.status === "ARCHIVED") {
    return { error: "Nao use um modelo arquivado para gerar um link." };
  }

  return {
    clientName: getClientDisplayName(client),
    teamId: client.teamId,
    responsibleUserId: client.responsibleUserId,
  };
}

async function getScopedSignatureRequestForWrite(
  actor: Awaited<ReturnType<typeof requireOperationalWriteAccess>>,
  requestId: string,
) {
  return prisma.signatureRequest.findFirst({
    where: buildSignatureRequestScopeWhere(actor, { id: requestId }),
    select: {
      id: true,
      sentAt: true,
      status: true,
      teamId: true,
      responsibleUserId: true,
      publicToken: true,
      title: true,
      client: {
        select: {
          clientType: true,
          legalName: true,
          contactName: true,
        },
      },
      evidence: {
        select: {
          selfiePath: true,
          signatureDrawnPath: true,
        },
      },
      signedDocument: {
        select: {
          storagePath: true,
        },
      },
    },
  });
}

function getPrismaErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");

      if (target.includes("serviceId")) {
        return "Este servico executado ja esta vinculado a outra solicitacao de assinatura.";
      }

      return "Ja existe uma solicitacao com esse token publico.";
    }

    if (error.code === "P2003") {
      const constraint = String(error.meta?.constraint ?? "");

      if (constraint.includes("createdById")) {
        return "Sua sessao nao e mais valida. Entre novamente.";
      }

      if (constraint.includes("templateId")) {
        return "Selecione um modelo valido para gerar a assinatura.";
      }

      if (constraint.includes("clientId")) {
        return "Selecione um cliente valido para gerar a assinatura.";
      }

      if (constraint.includes("serviceId")) {
        return "Selecione um servico executado valido para gerar a assinatura.";
      }
    }
  }

  return "Nao foi possivel salvar a assinatura.";
}

function buildStatusDates(params: {
  status: "DRAFT" | "SENT" | "CANCELED";
  previousSentAt?: Date | null;
}) {
  if (params.status === "SENT") {
    return {
      sentAt: params.previousSentAt ?? new Date(),
    };
  }

  if (params.status === "DRAFT") {
    return {
      sentAt: null,
    };
  }

  return {
    sentAt: params.previousSentAt ?? null,
  };
}

export async function createSignatureRequestAction(
  _previousState: SignatureRequestFormState,
  formData: FormData,
): Promise<SignatureRequestFormState> {
  const actor = await requireOperationalWriteAccess();
  const parsed = createSignatureRequestSchema.safeParse(buildSignatureRequestPayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const expiresAt = endOfDayFromDateInput(parsed.data.expiresAt);

  if (parsed.data.expiresAt && !expiresAt) {
    return { error: "Informe uma data de expiracao valida." };
  }

  const relationValidation = await validateRequestRelations({
    actor,
    ...parsed.data,
  });

  if ("error" in relationValidation) {
    return { error: relationValidation.error };
  }

  let request: { id: string; title: string };
  let clientName: string;

  try {
    request = await prisma.signatureRequest.create({
      data: {
        title: parsed.data.title,
        teamId: relationValidation.teamId,
        responsibleUserId: relationValidation.responsibleUserId,
        clientId: parsed.data.clientId,
        serviceId: parsed.data.serviceId,
        templateId: parsed.data.templateId,
        signerName: parsed.data.signerName,
        signerEmail: parsed.data.signerEmail,
        signerDocument: parsed.data.signerDocument || undefined,
        signerPhone: parsed.data.signerPhone || undefined,
        status: parsed.data.status,
        expiresAt,
        createdById: actor.id,
        ...buildStatusDates({
          status: parsed.data.status,
        }),
      },
      select: {
        id: true,
        title: true,
      },
    });

    clientName = relationValidation.clientName;
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "SIGNATURE_REQUEST_CREATED",
    description: `Solicitacao ${request.title} para ${clientName} criada por ${actor.email}.`,
    teamId: relationValidation.teamId,
    signatureRequestId: request.id,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/assinaturas");
  redirect(`/painel/assinaturas/${request.id}/editar`);
}

export async function updateSignatureRequestAction(
  requestId: string,
  _previousState: SignatureRequestFormState,
  formData: FormData,
): Promise<SignatureRequestFormState> {
  const actor = await requireOperationalWriteAccess();
  const parsed = updateSignatureRequestSchema.safeParse(buildSignatureRequestPayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const existingRequest = await getScopedSignatureRequestForWrite(actor, requestId);

  if (!existingRequest) {
    return { error: "Solicitacao nao encontrada ou fora do seu escopo." };
  }

  if (existingRequest.status === "SIGNED") {
    return { error: "Solicitacoes assinadas nao podem mais ser editadas." };
  }

  const relationValidation = await validateRequestRelations({
    actor,
    ...parsed.data,
    currentRequestId: requestId,
  });

  if ("error" in relationValidation) {
    return { error: relationValidation.error };
  }

  const expiresAt = endOfDayFromDateInput(parsed.data.expiresAt);

  if (parsed.data.expiresAt && !expiresAt) {
    return { error: "Informe uma data de expiracao valida." };
  }

  let request: { id: string; title: string };
  let clientName: string;

  try {
    request = await prisma.signatureRequest.update({
      where: { id: requestId },
      data: {
        title: parsed.data.title,
        teamId: relationValidation.teamId,
        responsibleUserId: relationValidation.responsibleUserId,
        clientId: parsed.data.clientId,
        serviceId: parsed.data.serviceId,
        templateId: parsed.data.templateId,
        signerName: parsed.data.signerName,
        signerEmail: parsed.data.signerEmail,
        signerDocument: parsed.data.signerDocument || undefined,
        signerPhone: parsed.data.signerPhone || undefined,
        status: parsed.data.status,
        expiresAt,
        ...buildStatusDates({
          status: parsed.data.status,
          previousSentAt: existingRequest.sentAt,
        }),
      },
      select: {
        id: true,
        title: true,
      },
    });

    clientName = relationValidation.clientName;
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "SIGNATURE_REQUEST_UPDATED",
    description: `Solicitacao ${request.title} para ${clientName} atualizada por ${actor.email}.`,
    teamId: relationValidation.teamId,
    signatureRequestId: request.id,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/assinaturas");
  revalidatePath(`/painel/assinaturas/${requestId}/editar`);
  redirect(`/painel/assinaturas/${requestId}/editar`);
}

export async function deleteSignatureRequestAction(
  requestId: string,
  previousState: SignatureRequestFormState,
): Promise<SignatureRequestFormState> {
  void previousState;
  const actor = await requireOperationalWriteAccess();

  const existingRequest = await getScopedSignatureRequestForWrite(actor, requestId);

  if (!existingRequest) {
    return { error: "Solicitacao nao encontrada ou fora do seu escopo." };
  }

  if (existingRequest.status === "SIGNED" && !canDeleteSignedSignatureRequests(actor)) {
    return { error: "Apenas super admin pode apagar solicitacoes assinadas." };
  }

  const clientName = getClientDisplayName(existingRequest.client);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditEvent.deleteMany({
        where: { signatureRequestId: requestId },
      });

      await tx.signedDocument.deleteMany({
        where: { signatureRequestId: requestId },
      });

      await tx.signatureEvidence.deleteMany({
        where: { signatureRequestId: requestId },
      });

      await tx.signatureRequest.delete({
        where: { id: requestId },
      });
    });

    await Promise.allSettled([
      deleteStoredEvidenceFile(existingRequest.evidence?.selfiePath),
      deleteStoredEvidenceFile(existingRequest.evidence?.signatureDrawnPath),
      deleteSignedContractPdf(existingRequest.signedDocument?.storagePath),
    ]);
  } catch {
    return { error: "Nao foi possivel apagar a assinatura." };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "SIGNATURE_REQUEST_DELETED",
    description: `Solicitacao ${existingRequest.title} (${existingRequest.publicToken}) para ${clientName} excluida por ${actor.email}.`,
    teamId: existingRequest.teamId,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/assinaturas");
  redirect("/painel/assinaturas");
}
