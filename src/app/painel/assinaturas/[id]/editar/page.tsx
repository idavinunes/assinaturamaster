import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, FileText, Mail, User2 } from "lucide-react";
import { SignatureRequestForm } from "@/components/signature-request-form";
import { DeleteSignatureRequestButton } from "@/components/delete-signature-request-button";
import { PublicSignatureLinkActions } from "@/components/public-signature-link-actions";
import { updateSignatureRequestAction } from "@/app/painel/assinaturas/actions";
import {
  buildClientScopeWhere,
  buildClientServiceScopeWhere,
  buildSignatureRequestScopeWhere,
  canDeleteSignedSignatureRequests,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import {
  buildAdminSignedDocumentPath,
  buildPublicSignaturePath,
  signatureRequestStatusLabels,
} from "@/lib/signature-requests";
import { prisma } from "@/lib/prisma";
import { buildTemplateScopeWhere } from "@/lib/template-access";
import { getClientDisplayName } from "@/lib/clients";

export const dynamic = "force-dynamic";

type EditSignatureRequestPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSignatureRequestPage({
  params,
}: EditSignatureRequestPageProps) {
  const session = await requireOperationalWriteAccess();
  const { id } = await params;

  const [request, clients, executedServices, templates] = await Promise.all([
    prisma.signatureRequest.findFirst({
      where: buildSignatureRequestScopeWhere(session, { id }),
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
            id: true,
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
            id: true,
            name: true,
            version: true,
            body: true,
            sourceFileName: true,
            sourceStoragePath: true,
          },
        },
        signedDocument: {
          select: {
            id: true,
            generatedAt: true,
            sizeBytes: true,
          },
        },
      },
    }),
    prisma.client.findMany({
      where: buildClientScopeWhere(session),
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        clientType: true,
        legalName: true,
        contactName: true,
        documentNumber: true,
        email: true,
        phone: true,
        isActive: true,
      },
    }),
    prisma.clientService.findMany({
      where: buildClientServiceScopeWhere(session),
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        clientId: true,
        identificationNumber: true,
        eventAmount: true,
        servicePercentage: true,
        amount: true,
        serviceCatalog: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.contractTemplate.findMany({
      where: buildTemplateScopeWhere(session, {
        status: {
          in: ["ACTIVE", "DRAFT"],
        },
      }),
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        version: true,
        status: true,
        scope: true,
        ownerTeam: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  if (!request) {
    notFound();
  }

  const editableStatus =
    request.status === "OPENED" || request.status === "SIGNED" || request.status === "EXPIRED"
      ? "SENT"
      : request.status;

  const isSigned = request.status === "SIGNED";
  const canDeleteSigned = canDeleteSignedSignatureRequests(session);
  const publicPath = buildPublicSignaturePath(request.publicToken);
  const clientDisplayName = getClientDisplayName(request.client);
  const serviceSummary = request.service
    ? `${request.service.serviceCatalog.name}${request.service.identificationNumber ? ` • ${request.service.identificationNumber}` : ""}`
    : "Sem servico executado";

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          <Link href="/painel/assinaturas" className="transition hover:text-accent">
            Assinaturas
          </Link>
          <span>/</span>
          <span className="text-slate-900">{isSigned ? "Concluida" : "Edicao"}</span>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {request.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              {isSigned
                ? "A solicitacao foi concluida e o acesso de edicao ficou bloqueado. O PDF assinado e a trilha publica seguem disponiveis."
                : "Ajuste cliente, modelo, assinante e o link publico mantendo o contexto operacional do contrato."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
              {signatureRequestStatusLabels[request.status]}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
              {clientDisplayName}
            </span>
            {request.expiresAt ? (
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                expira em {request.expiresAt.toLocaleDateString("pt-BR")}
              </span>
            ) : null}
          </div>
        </div>

      </header>

      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="eyebrow text-slate-400">Resumo rapido</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <FileText className="size-4 text-accent" />
                Modelo
              </div>
              <p className="font-semibold text-slate-900">
                {request.template.name} • v{request.template.version}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <Clock3 className="size-4 text-accent" />
                Servico
              </div>
              <p className="font-semibold text-slate-900">{serviceSummary}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <User2 className="size-4 text-accent" />
                Assinante
              </div>
              <p className="font-semibold text-slate-900">{request.signerName}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <Mail className="size-4 text-accent" />
                E-mail
              </div>
              <p className="break-all font-medium text-slate-900">{request.signerEmail}</p>
            </div>
          </div>
        </section>

        {!isSigned ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Edicao da assinatura</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Dados do link e do assinante
            </h2>

            <SignatureRequestForm
              action={updateSignatureRequestAction.bind(null, request.id)}
              submitLabel="Salvar alteracoes"
              pendingLabel="Salvando..."
              clients={clients}
              executedServices={executedServices.map((service) => ({
                ...service,
                eventAmount: service.eventAmount.toString(),
                servicePercentage: service.servicePercentage.toString(),
                amount: service.amount.toString(),
              }))}
              templates={templates}
              defaults={{
                title: request.title,
                clientId: request.clientId,
                serviceId: request.serviceId ?? "",
                templateId: request.templateId,
                signerName: request.signerName,
                signerEmail: request.signerEmail,
                signerDocument: request.signerDocument,
                signerPhone: request.signerPhone,
                status: editableStatus,
                expiresAt: request.expiresAt
                  ? request.expiresAt.toISOString().slice(0, 10)
                  : "",
              }}
            />
          </section>
        ) : (
          <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-sm leading-6 text-emerald-800 shadow-sm">
            O link publico foi encerrado automaticamente apos a assinatura e nao aceita mais alteracoes.
          </section>
        )}

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="eyebrow text-slate-400">Acesso publico</p>
          {request.status === "SIGNED" ? (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Este link foi encerrado automaticamente apos a assinatura.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Link da assinatura</p>
                <p className="break-all font-mono text-sm leading-6 text-slate-600">
                  {publicPath}
                </p>
                <p className="text-xs text-slate-400">Token: {request.publicToken}</p>
              </div>
              <div className="flex-shrink-0">
                <PublicSignatureLinkActions
                  publicPath={publicPath}
                  publicToken={request.publicToken}
                  variant="compact"
                />
              </div>
            </div>
          )}

          {request.signedDocument ? (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <p className="text-sm font-semibold text-slate-900">Documento assinado</p>
              <p className="mt-2 text-sm text-slate-500">
                Gerado em {request.signedDocument.generatedAt.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Tamanho:{" "}
                {request.signedDocument.sizeBytes
                  ? `${(request.signedDocument.sizeBytes / 1024).toFixed(1)} KB`
                  : "nao informado"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={buildAdminSignedDocumentPath(request.id)}
                  target="_blank"
                  className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ver PDF assinado
                </Link>
                <Link
                  href={`${buildAdminSignedDocumentPath(request.id)}?download=1`}
                  className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Baixar PDF
                </Link>
              </div>
            </div>
          ) : null}
        </section>

        {!isSigned || canDeleteSigned ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-rose-900">Apagar solicitacao</p>
            <p className="mt-2 text-sm leading-6 text-rose-800">
              {isSigned
                ? "Como super admin, voce pode remover ate uma solicitacao assinada durante os testes."
                : "Disponivel apenas enquanto o contrato ainda nao foi assinado."}
            </p>
            <div className="mt-4">
              <DeleteSignatureRequestButton
                requestId={request.id}
                label={isSigned ? "Apagar contrato assinado" : "Apagar assinatura"}
                pendingLabel="Apagando..."
                confirmMessage={
                  isSigned
                    ? "Deseja apagar esta solicitacao assinada? O PDF, a selfie, o rabisco e o historico vinculado serao removidos."
                    : "Deseja apagar esta solicitacao? Essa acao nao pode ser desfeita."
                }
                className="inline-flex items-center rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
