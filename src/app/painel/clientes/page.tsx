import { Prisma } from "@prisma/client";
import clsx from "clsx";
import { FileText, MoreVertical, Plus, Search, Briefcase, Signature } from "lucide-react";
import Link from "next/link";
import {
  buildClientScopeWhere,
  canManageOperationalRecords,
  canViewUnassignedOperationalRecords,
  hasTeamWideOperationalAccess,
  requireOperationalAccessContext,
} from "@/lib/access-control";
import { clientTypeLabels, getClientDisplayName } from "@/lib/clients";
import { formatCpfOrCnpj } from "@/lib/formatters/br";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ClientsPageProps = {
  searchParams?: Promise<{
    q?: string;
    scope?: string;
  }>;
};

function getClientInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const access = await requireOperationalAccessContext();
  const canManage = canManageOperationalRecords(access);
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

  const searchWhere: Prisma.ClientWhereInput | undefined = query
    ? {
        OR: [
          { legalName: { contains: query, mode: "insensitive" } },
          { contactName: { contains: query, mode: "insensitive" } },
          { documentNumber: { contains: query, mode: "insensitive" } },
          { rg: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
      }
    : undefined;

  const visibilityWhere: Prisma.ClientWhereInput | undefined =
    activeScope === "mine"
      ? {
          responsibleUserId: access.id,
        }
      : activeScope === "unassigned" && canViewUnassignedOperationalRecords(access)
        ? {
            responsibleUserId: null,
          }
        : undefined;

  const filters: Prisma.ClientWhereInput | undefined =
    searchWhere && visibilityWhere
      ? {
          AND: [visibilityWhere, searchWhere],
        }
      : searchWhere ?? visibilityWhere;

  const clients = await prisma.client.findMany({
    where: buildClientScopeWhere(access, filters),
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      clientType: true,
      legalName: true,
      documentNumber: true,
      contactName: true,
      email: true,
      phone: true,
      isActive: true,
      updatedAt: true,
      responsibleUserId: true,
      responsibleUser: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          documents: true,
          executedServices: true,
          signatureRequests: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Clientes</h1>
          <p className="max-w-3xl text-base font-medium text-slate-500">
            Busca rápida de clientes, contratos vinculados e histórico operacional.
          </p>
        </div>

        {canManage ? (
          <Link href="/painel/clientes/novo" className="button-primary">
            <Plus className="size-4" />
            Novo Cliente
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
              placeholder="Buscar por nome, documento, responsável..."
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button type="submit" className="button-primary button-primary-sm">
              Buscar
            </button>
            {activeScope !== "all" ? <input type="hidden" name="scope" value={activeScope} /> : null}
          </form>

          <div className="text-sm text-slate-500">{clients.length} resultado(s)</div>
        </div>

        {supportsTeamFilters ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/painel/clientes"
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
              href="/painel/clientes?scope=mine"
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
              href="/painel/clientes?scope=unassigned"
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
        <div className="hidden grid-cols-[1.2fr_0.9fr_0.9fr_0.55fr_0.8fr_0.4fr] gap-4 border-b border-slate-100 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 md:grid">
          <span>Cliente</span>
          <span>Documento</span>
          <span>Responsável</span>
          <span>Status</span>
          <span>Indicadores</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {clients.map((client) => (
            <article
              key={client.id}
              className="grid gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.55fr_0.8fr_0.4fr] md:items-center md:px-8"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
                  {getClientInitials(getClientDisplayName(client))}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {getClientDisplayName(client)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {clientTypeLabels[client.clientType]}
                  </p>
                </div>
              </div>

              <div className="text-sm text-slate-600">
                {client.documentNumber ? formatCpfOrCnpj(client.documentNumber) : "Não informado"}
              </div>

              <div className="text-sm text-slate-600">
                {client.responsibleUser?.name ?? "Sem responsável"}
              </div>

              <div>
                <span
                  className={clsx(
                    "inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                    client.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {client.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <FileText className="size-4" />
                  {client._count.documents}
                </span>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="size-4" />
                  {client._count.executedServices}
                </span>
                <span className="flex items-center gap-1.5">
                  <Signature className="size-4" />
                  {client._count.signatureRequests}
                </span>
              </div>

              <div className="flex md:justify-end">
                <Link
                  href={`/painel/clientes/${client.id}/editar`}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
                >
                  <MoreVertical className="size-4" />
                </Link>
              </div>
            </article>
          ))}

          {clients.length === 0 ? (
            <div className="px-8 py-10 text-sm text-slate-500">Nenhum cliente encontrado.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
