import clsx from "clsx";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { formatCurrencyBRL, formatPercentageBR } from "@/lib/formatters/br";
import { prisma } from "@/lib/prisma";
import { serviceCatalogScopeLabels } from "@/lib/service-catalog";
import {
  buildServiceCatalogScopeWhere,
  canEditServiceCatalog,
  canManageServiceCatalog,
  requireServiceCatalogAccessContext,
} from "@/lib/service-catalog-access";

export const dynamic = "force-dynamic";

type ServicesPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const access = await requireServiceCatalogAccessContext();
  const canManage = canManageServiceCatalog(access);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q?.trim() ?? "";

  const services = await prisma.serviceCatalog.findMany({
    where: buildServiceCatalogScopeWhere(access, query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined),
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
    include: {
      ownerTeam: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          executedServices: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Serviços</h1>
          <p className="max-w-3xl text-base font-medium text-slate-500">
            Catálogo base de serviços com escopo global ou restrito à equipe ativa.
          </p>
        </div>

        {canManage ? (
          <Link href="/painel/servicos/novo" className="button-primary">
            <Plus className="size-4" />
            Novo Serviço
          </Link>
        ) : null}
      </div>

      <form className="max-w-md">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Search className="size-4 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar serviço..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>
      </form>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.25fr_0.8fr_0.65fr_0.8fr_0.6fr_0.5fr_0.7fr_0.45fr] gap-4 border-b border-slate-100 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 md:grid">
          <span>Serviço</span>
          <span>Evento</span>
          <span>%</span>
          <span>Prestação base</span>
          <span>Escopo</span>
          <span>Status</span>
          <span>Executados</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {services.map((service) => (
            <article
              key={service.id}
              className="grid gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60 md:grid-cols-[1.25fr_0.8fr_0.65fr_0.8fr_0.6fr_0.5fr_0.7fr_0.45fr] md:items-center md:px-8"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{service.name}</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                  {service.description ?? "Sem descrição de evento."}
                </p>
              </div>

              <div className="text-sm font-semibold text-slate-900">
                {formatCurrencyBRL(service.defaultAmount.toString())}
              </div>

              <div className="text-sm font-semibold text-slate-900">
                {formatPercentageBR(service.defaultPercentage.toString())}
              </div>

              <div className="text-sm font-semibold text-slate-900">
                {formatCurrencyBRL(
                  ((Number(service.defaultAmount.toString()) * Number(service.defaultPercentage.toString())) / 100).toFixed(2),
                )}
              </div>

              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {service.scope === "GLOBAL"
                  ? serviceCatalogScopeLabels.GLOBAL
                  : `${serviceCatalogScopeLabels.TEAM_PRIVATE}${service.ownerTeam ? ` • ${service.ownerTeam.name}` : ""}`}
              </div>

              <div>
                <span
                  className={clsx(
                    "inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                    service.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {service.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="text-sm text-slate-500">{service._count.executedServices}</div>

              <div className="flex md:justify-end">
                {canEditServiceCatalog(access, service) ? (
                  <Link
                    href={`/painel/servicos/${service.id}/editar`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Editar
                  </Link>
                ) : (
                  <span className="text-sm text-slate-400">Leitura</span>
                )}
              </div>
            </article>
          ))}

          {services.length === 0 ? (
            <div className="px-8 py-10 text-sm text-slate-500">Nenhum serviço cadastrado ainda.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
