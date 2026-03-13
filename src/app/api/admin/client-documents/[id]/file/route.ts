import { NextRequest } from "next/server";
import {
  buildClientScopeWhere,
  canDownloadClientDocuments,
  getAccessContext,
} from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { readClientDocumentFile } from "@/lib/storage/client-documents";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await getAccessContext();

  if (!access || !access.capabilities.readOperationalData || !access.activeTeam) {
    return new Response("Nao autenticado.", { status: 401 });
  }

  const { id } = await context.params;
  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";

  if (shouldDownload && !canDownloadClientDocuments(access)) {
    return new Response("Somente gerente ou administrador podem baixar documentos.", {
      status: 403,
    });
  }

  const client = await prisma.client.findFirst({
    where: buildClientScopeWhere(access, {
      documents: {
        some: {
          id,
        },
      },
    }),
    select: {
      documents: {
        where: {
          id,
        },
        select: {
          fileName: true,
          mimeType: true,
          storageProvider: true,
          storagePath: true,
        },
      },
    },
  });
  const document = client?.documents[0];

  if (!document) {
    return new Response("Documento do cliente nao encontrado.", { status: 404 });
  }

  try {
    const fileBuffer = await readClientDocumentFile({
      storageProvider: document.storageProvider,
      storagePath: document.storagePath,
    });
    const contentDisposition = shouldDownload ? "attachment" : "inline";

    return new Response(fileBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": document.mimeType,
        "Content-Disposition": `${contentDisposition}; filename="${document.fileName}"`,
      },
    });
  } catch {
    return new Response("Documento do cliente nao encontrado.", { status: 404 });
  }
}
