import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOnlyOfficeRouteToken } from "@/lib/onlyoffice";
import { readTemplateSourceFile } from "@/lib/storage/template-sources";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return new Response("Token ausente.", { status: 401 });
  }

  try {
    const payload = await verifyOnlyOfficeRouteToken(token, "source");

    if (payload.resourceId !== id) {
      return new Response("Token invalido.", { status: 401 });
    }
  } catch {
    return new Response("Token invalido.", { status: 401 });
  }

  const template = await prisma.contractTemplate.findUnique({
    where: { id },
    select: {
      name: true,
      sourceFileName: true,
      sourceMimeType: true,
      sourceStoragePath: true,
    },
  });

  if (!template?.sourceStoragePath) {
    return new Response("Arquivo-fonte nao encontrado.", { status: 404 });
  }

  const buffer = await readTemplateSourceFile(template.sourceStoragePath).catch(() => null);

  if (!buffer) {
    return new Response("Arquivo-fonte nao encontrado.", { status: 404 });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type":
        template.sourceMimeType ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="${template.sourceFileName ?? `${template.name}.docx`}"`,
    },
  });
}
