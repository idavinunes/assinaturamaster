import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSignedContractPdf } from "@/lib/storage/signed-documents";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const requestRecord = await prisma.signatureRequest.findUnique({
    where: {
      publicToken: token,
    },
    select: {
      status: true,
      signedDocument: {
        select: {
          fileName: true,
          mimeType: true,
          storagePath: true,
        },
      },
    },
  });

  if (!requestRecord || requestRecord.status !== "SIGNED" || !requestRecord.signedDocument) {
    return new Response("Documento assinado nao encontrado.", { status: 404 });
  }

  try {
    const fileBuffer = await readSignedContractPdf(requestRecord.signedDocument.storagePath);
    const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
    const contentDisposition = shouldDownload ? "attachment" : "inline";

    return new Response(fileBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": requestRecord.signedDocument.mimeType,
        "Content-Disposition": `${contentDisposition}; filename="${requestRecord.signedDocument.fileName}"`,
      },
    });
  } catch {
    return new Response("Documento assinado nao encontrado.", { status: 404 });
  }
}
