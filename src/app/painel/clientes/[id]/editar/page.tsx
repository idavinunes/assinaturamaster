import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientDocumentUploadForm } from "@/components/client-document-upload-form";
import { DeleteExecutedServiceButton } from "@/components/delete-executed-service-button";
import { DeleteClientDocumentButton } from "@/components/delete-client-document-button";
import { ClientForm } from "@/components/client-form";
import { updateClientAction } from "@/app/painel/clientes/actions";
import {
  buildClientScopeWhere,
  canDeleteClientDocuments,
  canDownloadClientDocuments,
  canTransferOperationalOwnership,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { clientDocumentTypeLabels, formatFileSize } from "@/lib/client-documents";
import { getClientDisplayName } from "@/lib/clients";
import { formatCpfOrCnpj, formatCurrencyBRL, formatPercentageBR } from "@/lib/formatters/br";
import { prisma } from "@/lib/prisma";
import {
  buildAdminSignedDocumentPath,
  buildPublicSignaturePath,
  signatureRequestStatusLabels,
} from "@/lib/signature-requests";
import { teamMemberRoleLabels } from "@/lib/roles";
import { listAssignableTeamMembers } from "@/lib/team-members";

export const dynamic = "force-dynamic";

type EditClientPageProps = {
  params: Promise<{ id: string }>;
};

function buildSignatureStatusClass(status: string) {
  if (status === "SIGNED") {
    return "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700";
  }

  if (status === "OPENED") {
    return "inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700";
  }

  if (status === "SENT") {
    return "inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700";
  }

  if (status === "EXPIRED") {
    return "inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700";
  }

  return "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500";
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const access = await requireOperationalWriteAccess();
  const { id } = await params;

  const allowResponsibleSelection = canTransferOperationalOwnership(access);
  const allowDocumentDownload = canDownloadClientDocuments(access);
  const allowDocumentDeletion = canDeleteClientDocuments(access);

  const [client, responsibleOptions] = await Promise.all([
    prisma.client.findFirst({
      where: buildClientScopeWhere(access, { id }),
      select: {
        id: true,
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
        isActive: true,
        responsibleUserId: true,
        responsibleUser: {
          select: {
            name: true,
            email: true,
          },
        },
        documents: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            documentType: true,
            description: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
        executedServices: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            identificationNumber: true,
            description: true,
            eventAmount: true,
            servicePercentage: true,
            amount: true,
            updatedAt: true,
            serviceCatalog: {
              select: {
                name: true,
              },
            },
          },
        },
        signatureRequests: {
          orderBy: [{ signedAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            title: true,
            publicToken: true,
            status: true,
            signerName: true,
            signerEmail: true,
            expiresAt: true,
            signedAt: true,
            updatedAt: true,
            service: {
              select: {
                identificationNumber: true,
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
            signedDocument: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    }),
    allowResponsibleSelection && access.activeTeamId
      ? listAssignableTeamMembers(access.activeTeamId)
      : Promise.resolve([]),
  ]);

  if (!client) {
    notFound();
  }

  const clientDisplayName = getClientDisplayName(client);
  const visibleResponsibleSummary = client.responsibleUser
    ? `${client.responsibleUser.name} • ${client.responsibleUser.email}`
    : "Sem responsavel definido";

  return (
    <div className="space-y-8">
      <Link href="/painel/clientes" className="eyebrow text-slate-400">
        voltar para clientes
      </Link>

      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-slate-400">Cliente</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {clientDisplayName}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
                {client.clientType === "BUSINESS" ? "Empresarial" : "Pessoal"}
              </span>
              <span
                className={
                  client.isActive
                    ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                    : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"
                }
              >
                {client.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
              Atualize o cadastro, distribua a carteira e arquive documentos do cliente em um
              único fluxo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Documento
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {client.documentNumber ? formatCpfOrCnpj(client.documentNumber) : "Não informado"}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Contato
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {client.email ?? client.phone ?? client.contactName ?? "Não informado"}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Carteira
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {client.responsibleUser?.name ?? "Sem responsável"}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Relacionamentos
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {client.documents.length} docs • {client.executedServices.length} serviços •{" "}
                {client.signatureRequests.length} assinaturas
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Dados cadastrais</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Informações principais
            </h2>
            <ClientForm
              action={updateClientAction.bind(null, client.id)}
              submitLabel="Salvar alterações"
              pendingLabel="Salvando..."
              isEdit
              allowResponsibleSelection={allowResponsibleSelection}
              responsibleOptions={responsibleOptions.map((member) => ({
                value: member.userId,
                label: member.name,
                helper: `${member.email} • ${teamMemberRoleLabels[member.role]}`,
              }))}
              responsibleSummary={
                allowResponsibleSelection
                  ? "Atualize a atribuição da carteira quando precisar redistribuir o cliente."
                  : visibleResponsibleSummary
              }
              defaults={{
                clientType: client.clientType,
                legalName: client.legalName,
                documentNumber: client.documentNumber ?? "",
                responsibleUserId: client.responsibleUserId,
                contactName: client.contactName,
                civilStatus: client.civilStatus,
                rg: client.rg,
                email: client.email,
                phone: client.phone,
                address: client.address,
                notes: client.notes,
                isActive: client.isActive,
              }}
            />
          </section>
        </div>

        <aside className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="eyebrow text-slate-400">Resumo operacional</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Responsável
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {visibleResponsibleSummary}
                </p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Endereço
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {client.address ?? "Não informado"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-slate-400">Arquivos</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  Documentos do cliente
                </h2>
              </div>
              <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
                {client.documents.length} arquivo(s)
              </span>
            </div>

            <div className="mt-5">
              <ClientDocumentUploadForm clientId={client.id} variant="embedded" />
            </div>

            <div className="mt-5 grid gap-3">
              {client.documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      {clientDocumentTypeLabels[document.documentType]}
                    </p>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
                      {formatFileSize(document.sizeBytes)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-900">{document.fileName}</p>
                  {document.description ? (
                    <p className="mt-2 text-sm leading-6 text-slate-500">{document.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-400">
                    {document.mimeType} • enviado em {document.createdAt.toLocaleDateString("pt-BR")}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`/api/admin/client-documents/${document.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Abrir
                    </a>
                    {allowDocumentDownload ? (
                      <a
                        href={`/api/admin/client-documents/${document.id}/file?download=1`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                      >
                        Baixar
                      </a>
                    ) : null}
                    {allowDocumentDeletion ? (
                      <DeleteClientDocumentButton
                        clientId={client.id}
                        documentId={document.id}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    ) : null}
                  </div>
                </article>
              ))}

              {client.documents.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                  Nenhum documento arquivado ainda para este cliente.
                </div>
              ) : null}

              {!allowDocumentDownload || !allowDocumentDeletion ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                  Perfis abaixo de gerente podem abrir os anexos, mas não podem baixar nem apagar
                  documentos do cliente.
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-8 xl:items-start xl:grid-cols-2">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-slate-400">Histórico</p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
                Serviços deste cliente
              </h2>
            </div>

            <Link
              href={`/painel/servicos-executados/novo?clientId=${client.id}&returnToClientId=${client.id}`}
              className="button-primary"
            >
              <Plus className="size-4" />
              Novo Executado
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {client.executedServices.map((service) => (
              <article
                key={service.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.95fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {service.serviceCatalog.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {service.description ?? "Sem descrição de evento."}
                        </p>
                        <p className="mt-2 font-mono text-[11px] text-slate-400">
                          {service.identificationNumber ?? "Sem identificação"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Link
                          href={`/painel/servicos-executados/${service.id}/editar`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          Editar
                        </Link>
                        <DeleteExecutedServiceButton
                          executedServiceId={service.id}
                          returnToClientId={client.id}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          errorClassName="basis-full text-xs text-red-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Evento
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrencyBRL(service.eventAmount.toString())}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        percentual: {formatPercentageBR(service.servicePercentage.toString())}
                      </p>
                    </div>

                    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Prestação
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrencyBRL(service.amount.toString())}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        atualizado em {service.updatedAt.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {client.executedServices.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                Nenhum serviço executado cadastrado ainda.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-slate-400">Histórico</p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
                Contratos deste cliente
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Acesse rapidamente contratos em andamento ou PDFs assinados.
              </p>
            </div>

            <Link href="/painel/assinaturas/novo" className="button-primary">
              <Plus className="size-4" />
              Nova Assinatura
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {client.signatureRequests.map((request) => {
              const serviceSummary = request.service
                ? `${request.service.serviceCatalog.name}${request.service.identificationNumber ? ` • ${request.service.identificationNumber}` : ""}`
                : "Sem serviço executado";

              return (
                <article
                  key={request.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,1fr)]">
                    <div className="min-w-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{request.title}</p>
                            <span className={buildSignatureStatusClass(request.status)}>
                              {signatureRequestStatusLabels[request.status]}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            {request.signerName} • {request.signerEmail}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {serviceSummary} • {request.template.name} • v
                            {request.template.version}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Link
                            href={`/painel/assinaturas/${request.id}/editar`}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                          >
                            Abrir
                          </Link>
                          {request.signedDocument ? (
                            <Link
                              href={buildAdminSignedDocumentPath(request.id)}
                              target="_blank"
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                            >
                              Ver PDF
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                      <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Timeline
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          {request.signedAt
                            ? `Assinado em ${request.signedAt.toLocaleString("pt-BR")}`
                            : request.expiresAt
                              ? `Expira em ${request.expiresAt.toLocaleDateString("pt-BR")}`
                              : `Atualizado em ${request.updatedAt.toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>

                      <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Link público
                        </p>
                        <p className="mt-2 break-all font-mono text-xs text-slate-500">
                          {buildPublicSignaturePath(request.publicToken)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={buildPublicSignaturePath(request.publicToken)}
                      target="_blank"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      Página pública
                    </Link>
                    {request.signedDocument ? (
                      <Link
                        href={`${buildAdminSignedDocumentPath(request.id)}?download=1`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                      >
                        Baixar PDF
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {client.signatureRequests.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                Nenhuma assinatura cadastrada ainda para este cliente.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
