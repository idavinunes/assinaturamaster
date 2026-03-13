import { prisma } from "@/lib/prisma";

export async function getClientOperationalScope(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      teamId: true,
      responsibleUserId: true,
    },
  });
}

export async function syncExecutedServicesScopeFromClient(clientId: string) {
  const client = await getClientOperationalScope(clientId);

  if (!client) {
    return null;
  }

  await prisma.clientService.updateMany({
    where: {
      clientId,
    },
    data: {
      teamId: client.teamId,
      responsibleUserId: client.responsibleUserId,
    },
  });

  return client;
}

export async function syncSignatureRequestsScopeFromClient(clientId: string) {
  const client = await getClientOperationalScope(clientId);

  if (!client) {
    return null;
  }

  await prisma.signatureRequest.updateMany({
    where: {
      clientId,
    },
    data: {
      teamId: client.teamId,
      responsibleUserId: client.responsibleUserId,
    },
  });

  const signatureRequests = await prisma.signatureRequest.findMany({
    where: {
      clientId,
    },
    select: {
      id: true,
    },
  });

  if (signatureRequests.length > 0) {
    const signatureRequestIds = signatureRequests.map((request) => request.id);

    await prisma.signedDocument.updateMany({
      where: {
        signatureRequestId: {
          in: signatureRequestIds,
        },
      },
      data: {
        teamId: client.teamId,
      },
    });

    await prisma.auditEvent.updateMany({
      where: {
        signatureRequestId: {
          in: signatureRequestIds,
        },
      },
      data: {
        teamId: client.teamId,
      },
    });
  }

  return client;
}
