import { NextRequest } from "next/server";
import { getClientDisplayName } from "@/lib/clients";
import {
  appendEvidenceAppendixToPdf,
  buildSignedContractPdf,
  type SignedContractPayload,
} from "@/lib/pdf/build-signed-contract-pdf";
import {
  buildPublicSignatureDrawnSignaturePath,
} from "@/lib/signature-requests";
import {
  buildOnlyOfficeSignatureRenderedDocxUrl,
  buildOnlyOfficeDocumentKey,
} from "@/lib/onlyoffice";
import { convertDocxUrlToPdf } from "@/lib/onlyoffice-conversion";
import {
  persistDrawnSignature,
  readStoredEvidenceFile,
} from "@/lib/storage/signature-evidence";
import { persistSignedContractPdf } from "@/lib/storage/signed-documents";
import {
  buildSignatureRequestTemplateValues,
  renderTemplateDocument,
} from "@/lib/template-rendering";
import { publicSignatureFinalizeSchema } from "@/lib/validation/forms";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function getRequestIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "indisponivel";
}

function normalizeEvidenceImageMimeType(value?: string | null) {
  if (value === "image/png" || value === "image/jpeg") {
    return value;
  }

  return null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = publicSignatureFinalizeSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Dados finais da assinatura invalidos.",
        issues: parsed.error.flatten(),
      },
      {
        status: 400,
      },
    );
  }

  const signatureRequest = await prisma.signatureRequest.findUnique({
    where: {
      publicToken: token,
    },
    include: {
      team: {
        select: {
          id: true,
        },
      },
      client: {
        select: {
          clientType: true,
          legalName: true,
          documentNumber: true,
          contactName: true,
          civilStatus: true,
          rg: true,
          email: true,
          phone: true,
          address: true,
          notes: true,
        },
      },
      service: {
        select: {
          identificationNumber: true,
          description: true,
          eventAmount: true,
          servicePercentage: true,
          amount: true,
          createdAt: true,
          serviceCatalog: {
            select: {
              name: true,
            },
          },
        },
      },
      template: {
        select: {
          body: true,
          sourceFileName: true,
          sourceStoragePath: true,
        },
      },
      evidence: true,
    },
  });

  if (!signatureRequest) {
    return Response.json(
      {
        error: "Solicitacao de assinatura nao encontrada.",
      },
      {
        status: 404,
      },
    );
  }

  const now = new Date();
  const isExpiredByDate =
    signatureRequest.expiresAt !== null && signatureRequest.expiresAt < now;

  if (signatureRequest.status === "SIGNED") {
    return Response.json(
      {
        error: "Esta solicitacao ja foi assinada.",
      },
      {
        status: 409,
      },
    );
  }

  if (signatureRequest.status === "CANCELED" || signatureRequest.status === "EXPIRED" || isExpiredByDate) {
    return Response.json(
      {
        error: "Esta solicitacao nao pode mais ser assinada.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    !signatureRequest.evidence ||
    !signatureRequest.evidence.ipAddress ||
    signatureRequest.evidence.latitude === null ||
    signatureRequest.evidence.longitude === null ||
    !signatureRequest.evidence.selfiePath
  ) {
    return Response.json(
      {
        error: "Antes de finalizar, capture a selfie e o GPS deste link.",
      },
      {
        status: 409,
      },
    );
  }

  let drawnSignature;

  try {
    drawnSignature = await persistDrawnSignature({
      signatureRequestId: signatureRequest.id,
      signatureBase64: parsed.data.signatureBase64,
      previousSignaturePath: signatureRequest.evidence.signatureDrawnPath,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel processar a assinatura grafica.",
      },
      {
        status: 400,
      },
    );
  }

  const signedAtBrowser = new Date(parsed.data.signedAtBrowser);
  const renderedContract = await renderTemplateDocument({
    template: signatureRequest.template,
    values: buildSignatureRequestTemplateValues({
      title: signatureRequest.title,
      publicToken: signatureRequest.publicToken,
      signerName: signatureRequest.signerName,
      signerEmail: signatureRequest.signerEmail,
      signerDocument: signatureRequest.signerDocument,
      signerPhone: signatureRequest.signerPhone,
      client: signatureRequest.client,
      service: signatureRequest.service
        ? {
            identificationNumber: signatureRequest.service.identificationNumber,
            description: signatureRequest.service.description,
            eventAmount: signatureRequest.service.eventAmount.toString(),
            servicePercentage: signatureRequest.service.servicePercentage.toString(),
            amount: signatureRequest.service.amount.toString(),
            createdAt: signatureRequest.service.createdAt,
            serviceCatalog: signatureRequest.service.serviceCatalog,
          }
        : null,
    }),
  });

  const selfieMimeType = normalizeEvidenceImageMimeType(
    signatureRequest.evidence.selfieMimeType,
  );
  const drawnSignatureMimeType = normalizeEvidenceImageMimeType(drawnSignature.mimeType);
  const [selfieImageBytes, signatureMarkImageBytes] = await Promise.all([
    signatureRequest.evidence.selfiePath && selfieMimeType
      ? readStoredEvidenceFile(signatureRequest.evidence.selfiePath).catch(() => null)
      : Promise.resolve(null),
    drawnSignatureMimeType
      ? readStoredEvidenceFile(drawnSignature.storagePath).catch(() => null)
      : Promise.resolve(null),
  ]);

  const signedContractPayload: SignedContractPayload = {
    title: signatureRequest.title,
    clientName: getClientDisplayName(signatureRequest.client),
    signerName: signatureRequest.signerName,
    signerEmail: signatureRequest.signerEmail,
    templateBody: renderedContract.plainText,
    signedAt: signedAtBrowser.toLocaleString("pt-BR"),
    evidence: {
      ipAddress: signatureRequest.evidence.ipAddress,
      latitude: Number(signatureRequest.evidence.latitude),
      longitude: Number(signatureRequest.evidence.longitude),
      gpsAccuracyMeters: signatureRequest.evidence.gpsAccuracyMeters
        ? Number(signatureRequest.evidence.gpsAccuracyMeters)
        : null,
      locationAddress: signatureRequest.evidence.locationAddress,
      selfieCapturedAt: signatureRequest.evidence.selfieCapturedAt?.toISOString() ?? null,
      signatureDrawnAt: signedAtBrowser.toISOString(),
      selfieImage:
        selfieImageBytes && selfieMimeType
          ? {
              bytes: selfieImageBytes,
              mimeType: selfieMimeType,
            }
          : null,
      signatureMarkImage:
        signatureMarkImageBytes && drawnSignatureMimeType
          ? {
              bytes: signatureMarkImageBytes,
              mimeType: drawnSignatureMimeType,
            }
          : null,
    },
  };

  let pdfBytes: Uint8Array;

  if (renderedContract.mode === "DOCX") {
    const renderedDocxUrl = await buildOnlyOfficeSignatureRenderedDocxUrl(
      signatureRequest.id,
    );

    const convertedPdf = await convertDocxUrlToPdf({
      documentUrl: renderedDocxUrl,
      documentKey: buildOnlyOfficeDocumentKey({
        templateId: signatureRequest.id,
        updatedAt: now,
      }),
      fileName: `${signatureRequest.title || signatureRequest.id}.docx`,
    });

    pdfBytes = await appendEvidenceAppendixToPdf({
      basePdfBytes: convertedPdf,
      payload: signedContractPayload,
    });
  } else {
    pdfBytes = await buildSignedContractPdf(signedContractPayload);
  }

  const storedPdf = await persistSignedContractPdf({
    signatureRequestId: signatureRequest.id,
    pdfBytes,
  });

  const ipAddress = getRequestIpAddress(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  await prisma.$transaction(async (tx) => {
    await tx.signatureEvidence.update({
      where: {
        signatureRequestId: signatureRequest.id,
      },
      data: {
        ipAddress,
        userAgent,
        signatureDrawnPath: drawnSignature.storagePath,
        signatureDrawnMimeType: drawnSignature.mimeType,
        termsAccepted: true,
        termsVersion: parsed.data.termsVersion,
        signedAtBrowser,
      },
    });

    await tx.signatureRequest.update({
      where: {
        id: signatureRequest.id,
      },
      data: {
        status: "SIGNED",
        signedAt: signedAtBrowser,
        openedAt: signatureRequest.openedAt ?? now,
      },
    });

    await tx.signedDocument.upsert({
      where: {
        signatureRequestId: signatureRequest.id,
      },
      create: {
        signatureRequestId: signatureRequest.id,
        teamId: signatureRequest.team.id,
        fileName: storedPdf.fileName,
        storageProvider: "LOCAL",
        storagePath: storedPdf.storagePath,
        sizeBytes: storedPdf.sizeBytes,
        sha256: storedPdf.sha256,
      },
      update: {
        teamId: signatureRequest.team.id,
        fileName: storedPdf.fileName,
        storageProvider: "LOCAL",
        storagePath: storedPdf.storagePath,
        sizeBytes: storedPdf.sizeBytes,
        sha256: storedPdf.sha256,
        generatedAt: now,
      },
    });

    await tx.auditEvent.create({
      data: {
        action: "PUBLIC_REQUEST_SIGNED",
        description: "Solicitacao finalizada e marcada como assinada no link publico.",
        actorType: "SIGNER",
        ipAddress,
        userAgent,
        teamId: signatureRequest.teamId,
        signatureRequestId: signatureRequest.id,
        payload: JSON.stringify({
          signedAtBrowser,
          termsVersion: parsed.data.termsVersion,
          signedDocumentPath: storedPdf.storagePath,
        }),
      },
    });
  });

  return Response.json({
    status: "SIGNED",
    signedAt: signedAtBrowser.toISOString(),
    signatureUrl: `${buildPublicSignatureDrawnSignaturePath(token)}?v=${now.getTime()}`,
  });
}
