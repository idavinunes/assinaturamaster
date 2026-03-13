"use server";

import { Prisma, type ClientDocumentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildClientScopeWhere,
  canDeleteClientDocuments,
  canTransferOperationalOwnership,
  requireOperationalAccessContext,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { registerUserAudit } from "@/lib/audit";
import { clientDocumentTypeLabels } from "@/lib/client-documents";
import { getClientDisplayName } from "@/lib/clients";
import {
  syncExecutedServicesScopeFromClient,
  syncSignatureRequestsScopeFromClient,
} from "@/lib/client-operational-scope";
import { prisma } from "@/lib/prisma";
import {
  deleteStoredClientDocument,
  persistClientDocumentFile,
} from "@/lib/storage/client-documents";
import { findAssignableTeamMember } from "@/lib/team-members";
import {
  createClientSchema,
  updateClientSchema,
  uploadClientDocumentSchema,
} from "@/lib/validation/forms";

export type ClientFormState = {
  error?: string;
};

export type ClientDocumentFormState = {
  error?: string;
};

type ParsedClientData = {
  clientType: "PERSONAL" | "BUSINESS";
  legalName?: string;
  documentNumber: string;
  responsibleUserId?: string;
  contactName?: string;
  civilStatus?: string;
  rg?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ja existe um cliente com esse documento.";
  }

  return "Nao foi possivel salvar o cliente.";
}

function getClientDocumentErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel salvar o documento do cliente.";
}

function buildClientPayload(formData: FormData) {
  return {
    clientType: String(formData.get("clientType") ?? "BUSINESS"),
    legalName: String(formData.get("legalName") ?? "").trim(),
    documentNumber: String(formData.get("documentNumber") ?? "").trim(),
    responsibleUserId: optionalValue(formData.get("responsibleUserId")),
    contactName: optionalValue(formData.get("contactName")),
    civilStatus: optionalValue(formData.get("civilStatus")),
    rg: optionalValue(formData.get("rg")),
    email: optionalValue(formData.get("email")),
    phone: optionalValue(formData.get("phone")),
    address: optionalValue(formData.get("address")),
    notes: optionalValue(formData.get("notes")),
  };
}

function normalizeClientData(data: ParsedClientData) {
  if (data.clientType === "PERSONAL") {
    return {
      ...data,
      legalName: undefined,
    };
  }

  return {
    ...data,
    contactName: data.contactName || undefined,
  };
}

function buildClientDocumentPayload(formData: FormData) {
  return {
    documentType: String(formData.get("documentType") ?? ""),
    description: optionalValue(formData.get("description")),
  };
}

async function readClientDocumentUpload(formData: FormData) {
  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    throw new Error("Selecione um arquivo para enviar.");
  }

  return {
    fileName: fileEntry.name,
    mimeType: fileEntry.type,
    fileBytes: new Uint8Array(await fileEntry.arrayBuffer()),
  };
}

async function resolveResponsibleUserId(
  actor: Awaited<ReturnType<typeof requireOperationalAccessContext>>,
  requestedResponsibleUserId?: string,
) {
  if (!actor.activeTeamId) {
    throw new Error("TEAM_CONTEXT_REQUIRED");
  }

  if (!canTransferOperationalOwnership(actor)) {
    return actor.id;
  }

  if (!requestedResponsibleUserId) {
    return null;
  }

  const responsibleUser = await findAssignableTeamMember(
    actor.activeTeamId,
    requestedResponsibleUserId,
  );

  if (!responsibleUser) {
    throw new Error("INVALID_RESPONSIBLE_USER");
  }

  return responsibleUser.userId;
}

async function getScopedClientForWrite(
  actor: Awaited<ReturnType<typeof requireOperationalAccessContext>>,
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
      isActive: true,
      responsibleUser: {
        select: {
          name: true,
        },
      },
    },
  });
}

async function getScopedClientDocumentForWrite(
  actor: Awaited<ReturnType<typeof requireOperationalAccessContext>>,
  clientId: string,
  documentId: string,
) {
  return prisma.client.findFirst({
    where: buildClientScopeWhere(actor, {
      id: clientId,
      documents: {
        some: {
          id: documentId,
        },
      },
    }),
    select: {
      id: true,
      teamId: true,
      clientType: true,
      legalName: true,
      contactName: true,
      documents: {
        where: {
          id: documentId,
        },
        select: {
          id: true,
          documentType: true,
          fileName: true,
          storageProvider: true,
          storagePath: true,
        },
      },
    },
  });
}

export async function createClientAction(
  _previousState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const actor = await requireOperationalWriteAccess();
  const parsed = createClientSchema.safeParse(buildClientPayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  try {
    const data = normalizeClientData(parsed.data);
    const responsibleUserId = await resolveResponsibleUserId(actor, data.responsibleUserId);
    const client = await prisma.client.create({
      data: {
        ...data,
        teamId: actor.activeTeamId!,
        responsibleUserId,
      },
      select: {
        id: true,
        clientType: true,
        legalName: true,
        contactName: true,
        responsibleUser: {
          select: {
            name: true,
          },
        },
      },
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "CLIENT_CREATED",
      description: `Cliente ${getClientDisplayName(client)} criado por ${actor.email}${client.responsibleUser ? ` e atribuido a ${client.responsibleUser.name}` : " sem responsavel definido"}.`,
      teamId: actor.activeTeamId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RESPONSIBLE_USER") {
      return { error: "Selecione um responsavel ativo da equipe." };
    }

    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  redirect("/painel/clientes");
}

export async function updateClientAction(
  clientId: string,
  _previousState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const actor = await requireOperationalWriteAccess();
  const parsed = updateClientSchema.safeParse({
    ...buildClientPayload(formData),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const existingClient = await getScopedClientForWrite(actor, clientId);

  if (!existingClient) {
    return { error: "Cliente nao encontrado ou fora do seu escopo." };
  }

  try {
    const data = normalizeClientData(parsed.data);
    const responsibleUserId = await resolveResponsibleUserId(actor, data.responsibleUserId);
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...data,
        teamId: existingClient.teamId,
        responsibleUserId,
      },
      select: {
        id: true,
        clientType: true,
        legalName: true,
        contactName: true,
        responsibleUser: {
          select: {
            name: true,
          },
        },
      },
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "CLIENT_UPDATED",
      description: `Cliente ${getClientDisplayName(client)} atualizado por ${actor.email}.`,
      teamId: existingClient.teamId,
    });

    if (existingClient.responsibleUserId !== responsibleUserId) {
      await Promise.all([
        syncExecutedServicesScopeFromClient(clientId),
        syncSignatureRequestsScopeFromClient(clientId),
      ]);

      await registerUserAudit({
        actorUserId: actor.id,
        action: "CLIENT_RESPONSIBILITY_CHANGED",
        description: `Responsavel do cliente ${getClientDisplayName(client)} alterado de ${existingClient.responsibleUser?.name ?? "sem responsavel"} para ${client.responsibleUser?.name ?? "sem responsavel"} por ${actor.email}.`,
        teamId: existingClient.teamId,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RESPONSIBLE_USER") {
      return { error: "Selecione um responsavel ativo da equipe." };
    }

    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath(`/painel/clientes/${clientId}/editar`);
  redirect("/painel/clientes");
}

export async function toggleClientStatusAction(clientId: string) {
  const actor = await requireOperationalWriteAccess();
  const client = await prisma.client.findFirst({
    where: buildClientScopeWhere(actor, { id: clientId }),
    select: {
      id: true,
      teamId: true,
      clientType: true,
      legalName: true,
      contactName: true,
      isActive: true,
    },
  });

  if (!client) {
    return;
  }

  const nextStatus = !client.isActive;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      isActive: nextStatus,
    },
  });

  await registerUserAudit({
    actorUserId: actor.id,
    action: nextStatus ? "CLIENT_REACTIVATED" : "CLIENT_DEACTIVATED",
    description: `Cliente ${getClientDisplayName(client)} ${nextStatus ? "reativado" : "inativado"} por ${actor.email}.`,
    teamId: client.teamId,
  });

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath(`/painel/clientes/${clientId}/editar`);
}

export async function uploadClientDocumentAction(
  clientId: string,
  _previousState: ClientDocumentFormState,
  formData: FormData,
): Promise<ClientDocumentFormState> {
  const actor = await requireOperationalWriteAccess();
  const parsed = uploadClientDocumentSchema.safeParse(buildClientDocumentPayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const client = await getScopedClientForWrite(actor, clientId);

  if (!client) {
    return { error: "Cliente nao encontrado ou fora do seu escopo." };
  }

  let storedDocument:
    | Awaited<ReturnType<typeof persistClientDocumentFile>>
    | null = null;

  try {
    const fileUpload = await readClientDocumentUpload(formData);

    storedDocument = await persistClientDocumentFile({
      clientId,
      fileName: fileUpload.fileName,
      fileBytes: fileUpload.fileBytes,
      mimeType: fileUpload.mimeType,
    });

    const document = await prisma.clientDocument.create({
      data: {
        clientId: client.id,
        teamId: client.teamId,
        documentType: parsed.data.documentType,
        description: parsed.data.description,
        fileName: storedDocument.fileName,
        mimeType: storedDocument.mimeType,
        storageProvider: storedDocument.storageProvider,
        storagePath: storedDocument.storagePath,
        sizeBytes: storedDocument.sizeBytes,
      },
      select: {
        documentType: true,
        fileName: true,
      },
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "CLIENT_DOCUMENT_UPLOADED",
      description: `Documento ${clientDocumentTypeLabels[document.documentType as ClientDocumentType]} (${document.fileName}) anexado ao cliente ${getClientDisplayName(client)} por ${actor.email}.`,
      teamId: client.teamId,
    });
  } catch (error) {
    if (storedDocument) {
      await deleteStoredClientDocument({
        storageProvider: storedDocument.storageProvider,
        storagePath: storedDocument.storagePath,
      }).catch(() => {});
    }

    return { error: getClientDocumentErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath(`/painel/clientes/${clientId}/editar`);

  return {};
}

export async function deleteClientDocumentAction(
  clientId: string,
  documentId: string,
  _previousState: ClientDocumentFormState,
): Promise<ClientDocumentFormState> {
  void _previousState;
  const actor = await requireOperationalWriteAccess();

  if (!canDeleteClientDocuments(actor)) {
    return { error: "Somente gerente ou administrador podem apagar documentos." };
  }

  const client = await getScopedClientDocumentForWrite(actor, clientId, documentId);
  const document = client?.documents[0];

  if (!client || !document) {
    return { error: "Documento nao encontrado ou fora do seu escopo." };
  }

  try {
    await prisma.clientDocument.delete({
      where: {
        id: document.id,
      },
    });

    await deleteStoredClientDocument({
      storageProvider: document.storageProvider,
      storagePath: document.storagePath,
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "CLIENT_DOCUMENT_DELETED",
      description: `Documento ${clientDocumentTypeLabels[document.documentType as ClientDocumentType]} (${document.fileName}) removido do cliente ${getClientDisplayName(client)} por ${actor.email}.`,
      teamId: client.teamId,
    });
  } catch (error) {
    return { error: getClientDocumentErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath(`/painel/clientes/${clientId}/editar`);

  return {};
}
