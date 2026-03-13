import { NextRequest } from "next/server";
import { verifyOnlyOfficeRouteToken } from "@/lib/onlyoffice";
import { prisma } from "@/lib/prisma";
import {
  buildSignatureRequestTemplateValues,
  renderTemplateDocument,
} from "@/lib/template-rendering";

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
    const payload = await verifyOnlyOfficeRouteToken(token, "signature-rendered-docx");

    if (payload.resourceId !== id) {
      return new Response("Token invalido.", { status: 401 });
    }
  } catch {
    return new Response("Token invalido.", { status: 401 });
  }

  const signatureRequest = await prisma.signatureRequest.findUnique({
    where: { id },
    include: {
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
    },
  });

  if (!signatureRequest) {
    return new Response("Solicitacao nao encontrada.", { status: 404 });
  }

  const renderedDocument = await renderTemplateDocument({
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

  if (renderedDocument.mode !== "DOCX" || !renderedDocument.fileBytes) {
    return new Response("Este modelo nao possui fonte DOCX renderizavel.", {
      status: 409,
    });
  }

  const fileName =
    signatureRequest.template.sourceFileName ??
    `${signatureRequest.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || signatureRequest.id}.docx`;

  return new Response(Buffer.from(renderedDocument.fileBytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
