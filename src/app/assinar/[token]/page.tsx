import clsx from "clsx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppBrand } from "@/components/app-brand";
import { PublicSignatureEvidencePanel } from "@/components/public-signature-evidence-panel";
import { getResolvedBrandingSettings } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import {
  buildPublicSignedDocumentPath,
  buildPublicSignaturePreviewPath,
  buildPublicSignatureDrawnSignaturePath,
  buildPublicSignatureSelfiePath,
  signatureRequestStatusLabels,
} from "@/lib/signature-requests";

export const dynamic = "force-dynamic";

type PublicSignaturePageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({
  params,
}: PublicSignaturePageProps): Promise<Metadata> {
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
    title: `${request.title} • ${branding.browserTitle}`,
    description: branding.browserDescription,
  };
}

export default async function PublicSignaturePage({
  params,
}: PublicSignaturePageProps) {
  const { token } = await params;

  const request = await prisma.signatureRequest.findUnique({
    where: { publicToken: token },
    include: {
      client: {
        select: {
          clientType: true,
          legalName: true,
          documentNumber: true,
          contactName: true,
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
          name: true,
          version: true,
        },
      },
      evidence: {
        select: {
          ipAddress: true,
          latitude: true,
          longitude: true,
          gpsAccuracyMeters: true,
          locationAddress: true,
          selfiePath: true,
          selfieCapturedAt: true,
          signatureDrawnPath: true,
          signedAtBrowser: true,
          updatedAt: true,
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
  const previewUrl = buildPublicSignaturePreviewPath(request.publicToken);
  const signedDocumentUrl =
    request.status === "SIGNED" && request.signedDocument
      ? buildPublicSignedDocumentPath(request.publicToken)
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <AppBrand href="/" branding={branding} />
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="eyebrow text-slate-400">Assinatura digital</p>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            Conexão segura
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          {request.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          {request.status === "SIGNED"
            ? "Este link esta em modo consulta. O documento ja foi assinado e o PDF final segue disponivel."
            : "Siga as etapas para validar sua identidade e concluir a assinatura deste documento."}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <span
            className={clsx(
              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
              request.status === "SIGNED" && "bg-emerald-50 text-emerald-700",
              request.status === "OPENED" && "bg-sky-50 text-sky-700",
              request.status === "SENT" && "bg-amber-50 text-amber-700",
              request.status === "DRAFT" && "bg-slate-100 text-slate-700",
              request.status === "EXPIRED" && "bg-rose-50 text-rose-700",
              request.status === "CANCELED" && "bg-slate-200 text-slate-700",
            )}
          >
            {signatureRequestStatusLabels[request.status]}
          </span>

          {request.expiresAt ? (
            <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
              expira em {request.expiresAt.toLocaleDateString("pt-BR")}
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
              sem expiracao
            </span>
          )}
        </div>

        {request.status === "EXPIRED" ? (
          <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            Este link esta expirado. A administracao precisa atualizar a solicitacao
            antes de seguir com a assinatura.
          </div>
        ) : null}

        {request.status === "CANCELED" ? (
          <div className="mt-6 rounded-[24px] border border-slate-300 bg-slate-100 px-5 py-4 text-sm text-slate-700">
            Esta solicitacao foi cancelada no painel administrativo.
          </div>
        ) : null}

        <div className="mt-6">
          <PublicSignatureEvidencePanel
            publicToken={request.publicToken}
            signerName={request.signerName}
            requestTitle={request.title}
            requestStatus={request.status}
            previewUrl={previewUrl}
            signedDocumentUrl={signedDocumentUrl}
            captureDisabled={
              request.status === "EXPIRED" ||
              request.status === "CANCELED"
            }
            initialEvidence={
              request.evidence
                ? {
                    ipAddress: request.evidence.ipAddress,
                    latitude: request.evidence.latitude
                      ? Number(request.evidence.latitude)
                      : null,
                    longitude: request.evidence.longitude
                      ? Number(request.evidence.longitude)
                      : null,
                    gpsAccuracyMeters: request.evidence.gpsAccuracyMeters
                      ? Number(request.evidence.gpsAccuracyMeters)
                      : null,
                    locationAddress: request.evidence.locationAddress,
                    selfieCapturedAt:
                      request.evidence.selfieCapturedAt?.toISOString() ?? null,
                    selfieUrl: request.evidence.selfiePath
                      ? `${buildPublicSignatureSelfiePath(request.publicToken)}?v=${request.evidence.updatedAt.getTime()}`
                      : null,
                    signatureDrawnUrl: request.evidence.signatureDrawnPath
                      ? `${buildPublicSignatureDrawnSignaturePath(request.publicToken)}?v=${request.evidence.updatedAt.getTime()}`
                      : null,
                    signedAtBrowser:
                      request.evidence.signedAtBrowser?.toISOString() ?? null,
                    capturedAt: request.evidence.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </div>
      </div>
    </main>
  );
}
