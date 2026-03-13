import { NextRequest } from "next/server";
import { buildSignatureRequestScopeWhere, getAccessContext } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { readSignedContractPdf } from "@/lib/storage/signed-documents";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await getAccessContext();

  if (!access || !access.capabilities.readOperationalData || !access.activeTeam) {
    return new Response("Nao autenticado.", { status: 401 });
  }

  const { id } = await context.params;
  const requestRecord = await prisma.signatureRequest.findFirst({
    where: buildSignatureRequestScopeWhere(access, { id }),
    select: {
      signedDocument: {
        select: {
          fileName: true,
          mimeType: true,
          storagePath: true,
        },
      },
    },
  });
  const signedDocument = requestRecord?.signedDocument;

  if (!signedDocument) {
    return new Response("Documento assinado nao encontrado.", { status: 404 });
  }

  try {
    const fileBuffer = await readSignedContractPdf(signedDocument.storagePath);
    const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
    const contentDisposition = shouldDownload ? "attachment" : "inline";

    return new Response(fileBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": signedDocument.mimeType,
        "Content-Disposition": `${contentDisposition}; filename="${signedDocument.fileName}"`,
      },
    });
  } catch {
    return new Response("Documento assinado nao encontrado.", { status: 404 });
  }
}
