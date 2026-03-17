import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { getResolvedBrandingSettings } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import {
  buildPublicSignaturePath,
  buildPublicSignedDocumentPath,
} from "@/lib/signature-requests";
import {
  buildSignatureRequestTemplateValues,
  renderTemplateDocument,
} from "@/lib/template-rendering";

export const dynamic = "force-dynamic";

type PublicSignaturePreviewPageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({
  params,
}: PublicSignaturePreviewPageProps): Promise<Metadata> {
  const { token } = await params;
  const request = await prisma.signatureRequest.findUnique({
    where: { publicToken: token },
    select: {
      teamId: true,
      title: true,
    },
  });

  if (!request) {
    return {};
  }

  const branding = await getResolvedBrandingSettings(request.teamId);

  return {
    title: `Previa de ${request.title} • ${branding.browserTitle}`,
    description: branding.browserDescription,
  };
}

export default async function PublicSignaturePreviewPage({
  params,
}: PublicSignaturePreviewPageProps) {
  const { token } = await params;
  const request = await prisma.signatureRequest.findUnique({
    where: {
      publicToken: token,
    },
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
          name: true,
          version: true,
        },
      },
      signedDocument: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!request) {
    notFound();
  }

  const branding = await getResolvedBrandingSettings(request.teamId);
  const renderedContract = await renderTemplateDocument({
    template: request.template,
    values: buildSignatureRequestTemplateValues({
      title: request.title,
      publicToken: request.publicToken,
      signerName: request.signerName,
      signerEmail: request.signerEmail,
      signerDocument: request.signerDocument,
      signerPhone: request.signerPhone,
      client: request.client,
      service: request.service
        ? {
            identificationNumber: request.service.identificationNumber,
            description: request.service.description,
            eventAmount: request.service.eventAmount.toString(),
            servicePercentage: request.service.servicePercentage.toString(),
            amount: request.service.amount.toString(),
            createdAt: request.service.createdAt,
            serviceCatalog: request.service.serviceCatalog,
          }
        : null,
    }),
  });

  const signedDocumentUrl =
    request.status === "SIGNED" && request.signedDocument
      ? buildPublicSignedDocumentPath(request.publicToken)
      : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <AppBrand href="/" branding={branding} />

        <div className="mt-6 flex flex-col gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <p className="eyebrow text-slate-400">Modo leitura</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Previa do contrato
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Revise o documento com calma. Esta tela nao inicia nem finaliza a
              assinatura.
            </p>
            <div className="flex flex-wrap gap-2 text-sm text-slate-500">
              <span className="inline-flex rounded-full border border-slate-200 px-3 py-1">
                {request.title}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 px-3 py-1">
                Modelo {request.template.name} • v{request.template.version}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={buildPublicSignaturePath(request.publicToken)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar para assinatura
            </Link>
            {signedDocumentUrl ? (
              <Link href={signedDocumentUrl} target="_blank" className="button-primary">
                <ExternalLink className="size-4" />
                Ver PDF assinado
              </Link>
            ) : null}
          </div>
        </div>

        {renderedContract.renderWarning ? (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            {renderedContract.renderWarning}
          </div>
        ) : null}

        <article
          className="document-preview mt-8 rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-6 md:px-8 md:py-8"
          dangerouslySetInnerHTML={{ __html: renderedContract.html }}
        />
      </div>
    </main>
  );
}
