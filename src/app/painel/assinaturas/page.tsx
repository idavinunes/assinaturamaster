import { Prisma } from "@prisma/client";
import clsx from "clsx";
import { MoreVertical, Plus, Search } from "lucide-react";
import Link from "next/link";
import { DeleteSignatureRequestButton } from "@/components/delete-signature-request-button";
import {
  buildSignatureRequestScopeWhere,
  canDeleteSignedSignatureRequests,
  canManageOperationalRecords,
  canViewUnassignedOperationalRecords,
  hasTeamWideOperationalAccess,
  requireOperationalAccessContext,
} from "@/lib/access-control";
import { getClientDisplayName } from "@/lib/clients";
import { prisma } from "@/lib/prisma";
import {
  buildAdminSignedDocumentPath,
  buildPublicSignaturePath,
  signatureRequestStatusLabels,
} from "@/lib/signature-requests";

export const dynamic = "force-dynamic";

type SignatureRequestsPageProps = {
  searchParams?: Promise<{
    q?: string;
    scope?: string;
  }>;
};

function buildSignatureStatusClass(status: string) {
  return clsx(
    "inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
    status === "SIGNED" && "bg-emerald-50 text-emerald-700",
    status === "OPENED" && "bg-blue-50 text-blue-700",
    status === "SENT" && "bg-amber-50 text-amber-700",
    status === "DRAFT" && "bg-slate-100 text-slate-600",
    status === "EXPIRED" && "bg-rose-50 text-rose-700",
    status === "CANCELED" && "bg-slate-200 text-slate-600",
  );
}

export default async function SignatureRequestsPage({
  searchParams,
}: SignatureRequestsPageProps) {
  const access = await requireOperationalAccessContext();
  const canManage = canManageOperationalRecords(access);
  const canDeleteSigned = canDeleteSignedSignatureRequests(access);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q?.trim() ?? "";
  const requestedScope = resolvedSearchParams?.scope?.trim() ?? "";
  const supportsTeamFilters = hasTeamWideOperationalAccess(access);
  const activeScope =
    supportsTeamFilters && requestedScope === "mine"
      ? "mine"
      : supportsTeamFilters && requestedScope === "unassigned"
        ? "unassigned"
        : "all";

  const searchWhere: Prisma.SignatureRequestWhereInput | undefined = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { publicToken: { contains: query, mode: "insensitive" } },
          { signerName: { contains: query, mode: "insensitive" } },
          { signerEmail: { contains: query, mode: "insensitive" } },
          {
            client: {
              OR: [
                { legalName: { contains: query, mode: "insensitive" } },
                { contactName: { contains: query, mode: "insensitive" } },
              ],
            },
          },
          {
            service: {
              identificationNumber: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        ],
      }
    : undefined;

  const visibilityWhere: Prisma.SignatureRequestWhereInput | undefined =
    activeScope === "mine"
      ? { responsibleUserId: access.id }
      : activeScope === "unassigned" && canViewUnassignedOperationalRecords(access)
        ? { responsibleUserId: null }
        : undefined;

  const filters: Prisma.SignatureRequestWhereInput | undefined =
    searchWhere && visibilityWhere
      ? {
          AND: [visibilityWhere, searchWhere],
        }
      : searchWhere ?? visibilityWhere;

  const requests = await prisma.signatureRequest.findMany({
    where: buildSignatureRequestScopeWhere(access, filters),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      client: {
        select: {
          clientType: true,
          legalName: true,
          contactName: true,
        },
      },
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
      responsibleUser: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Assinaturas</h1>
          <p className="max-w-3xl text-base font-medium text-slate-500">
            Gestão de links públicos, status e próxima ação por assinatura.
          </p>
        </div>

        {canManage ? (
          <Link href="/painel/assinaturas/novo" className="button-primary">
            <Plus className="size-4" />
            Nova Assinatura
          </Link>
        ) : null}
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search className="size-4 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Buscar por documento, cliente, assinante ou token..."
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button type="submit" className="button-primary button-primary-sm">
              Buscar
            </button>
            {activeScope !== "all" ? <input type="hidden" name="scope" value={activeScope} /> : null}
          </form>

          <div className="text-sm text-slate-500">{requests.length} resultado(s)</div>
        </div>

        {supportsTeamFilters ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/painel/assinaturas"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                activeScope === "all"
                  ? "border-slate-200 bg-slate-100 text-slate-900"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50",
              )}
            >
              Todos
            </Link>
            <Link
              href="/painel/assinaturas?scope=mine"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                activeScope === "mine"
                  ? "border-slate-200 bg-slate-100 text-slate-900"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50",
              )}
            >
              Minha carteira
            </Link>
            <Link
              href="/painel/assinaturas?scope=unassigned"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                activeScope === "unassigned"
                  ? "border-slate-200 bg-slate-100 text-slate-900"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50",
              )}
            >
              Sem responsável
            </Link>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.2fr_0.9fr_0.85fr_0.8fr_0.6fr_0.4fr] gap-4 border-b border-slate-100 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 md:grid">
          <span>Documento</span>
          <span>Cliente</span>
          <span>Assinante</span>
          <span>Responsável</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {requests.map((request) => (
            <article
              key={request.id}
              className="grid gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60 md:grid-cols-[1.2fr_0.9fr_0.85fr_0.8fr_0.6fr_0.4fr] md:items-center md:px-8"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{request.title}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">{request.publicToken}</p>
              </div>

              <div className="min-w-0 text-sm text-slate-600">
                <p className="truncate">{getClientDisplayName(request.client)}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {request.service?.serviceCatalog.name ?? "Sem serviço"}
                </p>
              </div>

              <div className="min-w-0 text-sm text-slate-600">
                <p className="truncate">{request.signerName}</p>
                <p className="mt-1 truncate text-[11px] text-slate-400">{request.signerEmail}</p>
              </div>

              <div className="min-w-0 text-sm text-slate-600">
                <p className="truncate">{request.responsibleUser?.name ?? "Sem responsável"}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {request.template.name} • v{request.template.version}
                </p>
              </div>

              <div>
                <span className={buildSignatureStatusClass(request.status)}>
                  {signatureRequestStatusLabels[request.status]}
                </span>
              </div>

              <div className="flex items-center justify-start gap-2 md:justify-end">
                {request.status !== "SIGNED" ? (
                  <Link
                    href={buildPublicSignaturePath(request.publicToken)}
                    target="_blank"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Abrir
                  </Link>
                ) : null}
                {request.status !== "SIGNED" ? (
                  <Link
                    href={`/painel/assinaturas/${request.id}/editar`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Editar
                  </Link>
                ) : request.signedDocument ? (
                  <Link
                    href={buildAdminSignedDocumentPath(request.id)}
                    target="_blank"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    PDF
                  </Link>
                ) : null}
                {request.status !== "SIGNED" || canDeleteSigned ? (
                  <DeleteSignatureRequestButton
                    requestId={request.id}
                    label="Apagar"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    errorClassName="hidden"
                  />
                ) : (
                  <span className="inline-flex size-9 items-center justify-center rounded-full border border-transparent text-slate-300">
                    <MoreVertical className="size-4" />
                  </span>
                )}
              </div>
            </article>
          ))}

          {requests.length === 0 ? (
            <div className="px-8 py-10 text-sm text-slate-500">Nenhuma assinatura encontrada.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
