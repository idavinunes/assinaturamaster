import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPublicSignatureSelfiePath } from "@/lib/signature-requests";
import { persistSignatureSelfie } from "@/lib/storage/signature-evidence";
import { publicSignatureEvidenceCaptureSchema } from "@/lib/validation/forms";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function getRequestIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "indisponivel";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = publicSignatureEvidenceCaptureSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Dados de evidencia invalidos.",
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
    select: {
      id: true,
      teamId: true,
      status: true,
      expiresAt: true,
      openedAt: true,
      evidence: {
        select: {
          selfiePath: true,
        },
      },
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

  if (signatureRequest.status === "CANCELED" || signatureRequest.status === "SIGNED") {
    return Response.json(
      {
        error: "Esta solicitacao nao aceita nova coleta de evidencia.",
      },
      {
        status: 409,
      },
    );
  }

  if (signatureRequest.status === "EXPIRED" || isExpiredByDate) {
    return Response.json(
      {
        error: "Esta solicitacao esta expirada.",
      },
      {
        status: 409,
      },
    );
  }

  const ipAddress = getRequestIpAddress(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const payload = parsed.data;
  const hasLocationPayload =
    payload.latitude !== undefined ||
    payload.longitude !== undefined ||
    payload.gpsAccuracyMeters !== undefined ||
    payload.locationAddress !== undefined;
  let savedSelfie: Awaited<ReturnType<typeof persistSignatureSelfie>> | null = null;

  if (payload.selfieBase64) {
    try {
      savedSelfie = await persistSignatureSelfie({
        signatureRequestId: signatureRequest.id,
        selfieBase64: payload.selfieBase64,
        previousSelfiePath: signatureRequest.evidence?.selfiePath,
      });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Nao foi possivel processar a selfie enviada.",
        },
        {
          status: 400,
        },
      );
    }
  }

  const selfieCapturedAt = payload.selfieCapturedAt
    ? new Date(payload.selfieCapturedAt)
    : savedSelfie
      ? now
      : null;

  const evidence = await prisma.$transaction(async (tx) => {
    if (signatureRequest.status === "SENT" && !signatureRequest.openedAt) {
      await tx.signatureRequest.update({
        where: {
          id: signatureRequest.id,
        },
        data: {
          status: "OPENED",
          openedAt: now,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "PUBLIC_LINK_OPENED",
          description: "Link publico aberto pelo signatario.",
          actorType: "SIGNER",
          ipAddress,
          userAgent,
          teamId: signatureRequest.teamId,
          signatureRequestId: signatureRequest.id,
        },
      });
    }

    const savedEvidence = await tx.signatureEvidence.upsert({
      where: {
        signatureRequestId: signatureRequest.id,
      },
      create: {
        signatureRequestId: signatureRequest.id,
        ipAddress,
        userAgent,
        latitude: payload.latitude,
        longitude: payload.longitude,
        gpsAccuracyMeters: payload.gpsAccuracyMeters,
        locationAddress: payload.locationAddress,
        ...(savedSelfie
          ? {
              selfiePath: savedSelfie.storagePath,
              selfieMimeType: savedSelfie.mimeType,
              selfieCapturedAt,
            }
          : {}),
        source: "WEB_LINK",
      },
      update: {
        ipAddress,
        userAgent,
        ...(payload.latitude !== undefined ? { latitude: payload.latitude } : {}),
        ...(payload.longitude !== undefined ? { longitude: payload.longitude } : {}),
        ...(payload.gpsAccuracyMeters !== undefined
          ? { gpsAccuracyMeters: payload.gpsAccuracyMeters }
          : {}),
        ...(payload.locationAddress !== undefined
          ? { locationAddress: payload.locationAddress }
          : {}),
        ...(savedSelfie
          ? {
              selfiePath: savedSelfie.storagePath,
              selfieMimeType: savedSelfie.mimeType,
              selfieCapturedAt,
            }
          : {}),
      },
    });

    if (hasLocationPayload) {
      await tx.auditEvent.create({
        data: {
          action: "PUBLIC_EVIDENCE_CAPTURED",
          description: "IP e dados de geolocalizacao registrados no link publico.",
          actorType: "SIGNER",
          ipAddress,
          userAgent,
          teamId: signatureRequest.teamId,
          signatureRequestId: signatureRequest.id,
          payload: JSON.stringify({
            latitude: payload.latitude,
            longitude: payload.longitude,
            gpsAccuracyMeters: payload.gpsAccuracyMeters,
            locationAddress: payload.locationAddress,
          }),
        },
      });
    }

    if (savedSelfie) {
      await tx.auditEvent.create({
        data: {
          action: "PUBLIC_SELFIE_CAPTURED",
          description: "Selfie de evidencia registrada no link publico.",
          actorType: "SIGNER",
          ipAddress,
          userAgent,
          teamId: signatureRequest.teamId,
          signatureRequestId: signatureRequest.id,
          payload: JSON.stringify({
            mimeType: savedSelfie.mimeType,
            selfieCapturedAt,
          }),
        },
      });
    }

    return savedEvidence;
  });

  return Response.json({
    ipAddress: evidence.ipAddress,
    latitude: evidence.latitude ? Number(evidence.latitude) : null,
    longitude: evidence.longitude ? Number(evidence.longitude) : null,
    gpsAccuracyMeters: evidence.gpsAccuracyMeters
      ? Number(evidence.gpsAccuracyMeters)
      : null,
    locationAddress: evidence.locationAddress,
    selfieCapturedAt: evidence.selfieCapturedAt?.toISOString() ?? null,
    selfieUrl: evidence.selfiePath
      ? `${buildPublicSignatureSelfiePath(token)}?v=${evidence.updatedAt.getTime()}`
      : null,
    signedAtBrowser: evidence.signedAtBrowser?.toISOString() ?? null,
    capturedAt: evidence.updatedAt.toISOString(),
  });
}
