import clsx from "clsx";
import { Plus, Search, Signature } from "lucide-react";
import Link from "next/link";
import { DeleteExecutedServiceButton } from "@/components/delete-executed-service-button";
import {
  buildClientServiceScopeWhere,
  canManageOperationalRecords,
  canViewUnassignedOperationalRecords,
  hasTeamWideOperationalAccess,
  requireOperationalAccessContext,
} from "@/lib/access-control";
import { getClientDisplayName } from "@/lib/clients";
import { formatCurrencyBRL, formatPercentageBR } from "@/lib/formatters/br";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ExecutedServicesPageProps = {
  searchParams?: Promise<{
    q?: string;
    scope?: string;
  }>;
};

export default async function ExecutedServicesPage({
  searchParams,
}: ExecutedServicesPageProps) {
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

  const visibilityWhere =
    activeScope === "mine"
      ? {
          responsibleUserId: access.id,
        }
      : activeScope === "unassigned" && canViewUnassignedOperationalRecords(access)
        ? {
            responsibleUserId: null,
          }
        : undefined;

  const searchWhere = query
    ? {
        OR: [
          { identificationNumber: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { serviceCatalog: { name: { contains: query, mode: "insensitive" as const } } },
          {
            client: {
              OR: [
                { legalName: { contains: query, mode: "insensitive" as const } },
                { contactName: { contains: query, mode: "insensitive" as const } },
              ],
            },
          },
        ],
      }
    : undefined;

  const filters =
    visibilityWhere && searchWhere
      ? {
          AND: [visibilityWhere, searchWhere],
        }
      : visibilityWhere ?? searchWhere;

  const executedServices = await prisma.clientService.findMany({
    where: buildClientServiceScopeWhere(access, filters),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      responsibleUser: {
        select: {
          name: true,
        },
      },
      client: {
        select: {
          id: true,
          clientType: true,
          legalName: true,
          contactName: true,
        },
      },
      serviceCatalog: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          signatureRequests: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Serviços Executados</h1>
          <p className="max-w-3xl text-base font-medium text-slate-500">
            Histórico operacional por cliente, com valores, percentual e uso em assinatura.
          </p>
        </div>

        {canManage ? (
          <Link href="/painel/servicos-executados/novo" className="button-primary">
            <Plus className="size-4" />
            Novo Serviço
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
              placeholder="Buscar por cliente, serviço ou identificação..."
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button type="submit" className="button-primary button-primary-sm">
              Buscar
            </button>
            {activeScope !== "all" ? <input type="hidden" name="scope" value={activeScope} /> : null}
          </form>
        </div>

        {supportsTeamFilters ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/painel/servicos-executados"
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
              href="/painel/servicos-executados?scope=mine"
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
              href="/painel/servicos-executados?scope=unassigned"
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
        <div className="hidden grid-cols-[1fr_1fr_0.85fr_0.7fr_0.6fr_0.75fr_0.6fr_0.5fr] gap-4 border-b border-slate-100 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 md:grid">
          <span>Serviço / Identificação</span>
          <span>Cliente</span>
          <span>Responsável</span>
          <span>Evento</span>
          <span>%</span>
          <span>Prestação</span>
          <span>Assinatura</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {executedServices.map((service) => (
            <article
              key={service.id}
              className="grid gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60 md:grid-cols-[1fr_1fr_0.85fr_0.7fr_0.6fr_0.75fr_0.6fr_0.5fr] md:items-center md:px-8"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{service.serviceCatalog.name}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  {service.identificationNumber ?? "Sem identificação"}
                </p>
              </div>

              <div className="min-w-0 text-sm text-slate-600">
                <p className="truncate">{getClientDisplayName(service.client)}</p>
                <p className="mt-1 truncate text-[11px] text-slate-400">
                  {service.description ?? "Sem descrição"}
                </p>
              </div>

              <div className="text-sm text-slate-600">
                {service.responsibleUser?.name ?? "Sem responsável"}
              </div>

              <div className="text-sm font-semibold text-slate-900">
                {formatCurrencyBRL(service.eventAmount.toString())}
              </div>

              <div className="text-sm font-semibold text-slate-900">
                {formatPercentageBR(service.servicePercentage.toString())}
              </div>

              <div className="text-sm font-semibold text-slate-900">
                {formatCurrencyBRL(service.amount.toString())}
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Signature className="size-4 text-blue-500" />
                {service._count.signatureRequests}
              </div>

              <div className="flex items-center justify-start gap-2 md:justify-end">
                <Link
                  href={`/painel/servicos-executados/${service.id}/editar`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Editar
                </Link>
                {canManage ? (
                  <DeleteExecutedServiceButton
                    executedServiceId={service.id}
                    label="Apagar"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    errorClassName="hidden"
                  />
                ) : null}
              </div>
            </article>
          ))}

          {executedServices.length === 0 ? (
            <div className="px-8 py-10 text-sm text-slate-500">
              Nenhum serviço executado encontrado.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
