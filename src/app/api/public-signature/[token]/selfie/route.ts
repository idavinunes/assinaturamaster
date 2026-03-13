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
          selfiePath: true,
          selfieMimeType: true,
        },
      },
    },
  });

  if (
    !request ||
    request.status === "SIGNED" ||
    !request.evidence?.selfiePath ||
    !request.evidence.selfieMimeType
  ) {
    return new Response("Selfie nao encontrada.", { status: 404 });
  }

  try {
    const fileBuffer = await readStoredEvidenceFile(request.evidence.selfiePath);

    return new Response(fileBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": request.evidence.selfieMimeType,
        "Content-Disposition": 'inline; filename="selfie-evidencia"',
      },
    });
  } catch {
    return new Response("Selfie nao encontrada.", { status: 404 });
  }
}
