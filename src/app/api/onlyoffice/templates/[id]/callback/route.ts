import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOnlyOfficeRouteToken } from "@/lib/onlyoffice";
import { persistTemplateSourceFile } from "@/lib/storage/template-sources";
import { extractTemplateBodyFromSource } from "@/lib/template-rendering";

type OnlyOfficeCallbackPayload = {
  status?: number;
  url?: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return Response.json({ error: 1 }, { status: 401 });
  }

  try {
    const payload = await verifyOnlyOfficeRouteToken(token, "callback");

    if (payload.resourceId !== id) {
      return Response.json({ error: 1 }, { status: 401 });
    }
  } catch {
    return Response.json({ error: 1 }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as OnlyOfficeCallbackPayload;

  if (body.status !== 2 && body.status !== 6) {
    return Response.json({ error: 0 });
  }

  if (!body.url) {
    return Response.json({ error: 1 }, { status: 400 });
  }

  const template = await prisma.contractTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sourceFileName: true,
      sourceMimeType: true,
      sourceStoragePath: true,
    },
  });

  if (!template) {
    return Response.json({ error: 1 }, { status: 404 });
  }

  const response = await fetch(body.url);

  if (!response.ok) {
    return Response.json({ error: 1 }, { status: 502 });
  }

  const downloadedFile = new Uint8Array(await response.arrayBuffer());

  try {
    const extractedBody = await extractTemplateBodyFromSource(downloadedFile);
    const storedFile = await persistTemplateSourceFile({
      templateId: template.id,
      fileName: template.sourceFileName ?? `${template.name}.docx`,
      fileBytes: downloadedFile,
      mimeType: template.sourceMimeType,
      previousStoragePath: template.sourceStoragePath,
    });

    await prisma.contractTemplate.update({
      where: { id: template.id },
      data: {
        body: extractedBody,
        sourceFileName: storedFile.fileName,
        sourceMimeType: storedFile.mimeType,
        sourceStoragePath: storedFile.storagePath,
      },
    });

    revalidatePath("/painel/modelos");
    revalidatePath(`/painel/modelos/${template.id}/editar`);
    revalidatePath(`/painel/modelos/${template.id}/editor`);
    revalidatePath(`/editor/modelos/${template.id}`);

    return Response.json({ error: 0 });
  } catch {
    return Response.json({ error: 1 }, { status: 400 });
  }
}
