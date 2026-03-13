import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStoredEvidenceFile } from "@/lib/storage/signature-evidence";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  const request = await prisma.signatureRequest.findUnique({
    where: {
      publicToken: token,
    },
    select: {
      status: true,
      evidence: {
        select: {
          signatureDrawnPath: true,
          signatureDrawnMimeType: true,
        },
      },
    },
  });

  if (
    !request ||
    request.status === "SIGNED" ||
    !request.evidence?.signatureDrawnPath ||
    !request.evidence.signatureDrawnMimeType
  ) {
    return new Response("Assinatura grafica nao encontrada.", { status: 404 });
  }

  try {
    const fileBuffer = await readStoredEvidenceFile(request.evidence.signatureDrawnPath);

    return new Response(fileBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": request.evidence.signatureDrawnMimeType,
        "Content-Disposition": 'inline; filename="assinatura-grafica"',
      },
    });
  } catch {
    return new Response("Assinatura grafica nao encontrada.", { status: 404 });
  }
}
