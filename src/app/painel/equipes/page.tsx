import { Prisma } from "@prisma/client";
import { ArrowUpRight, Palette, Plus, Search, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { canManageGlobalAdministration } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { buildManagedTeamsWhere, requireTeamManagementAccess } from "@/lib/team-access";

export const dynamic = "force-dynamic";

type TeamsPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const actor = await requireTeamManagementAccess();
  const canCreateTeam = canManageGlobalAdministration(actor);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q?.trim() ?? "";

  const managedWhere = buildManagedTeamsWhere(actor);
  const searchWhere: Prisma.TeamWhereInput | undefined = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      }
    : undefined;

  const where =
    managedWhere && searchWhere
      ? {
          AND: [managedWhere, searchWhere],
        }
      : managedWhere ?? searchWhere;

  const teams = await prisma.team.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      brandingSettings: {
        select: {
          id: true,
        },
      },
      memberships: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Equipes</h1>
          <p className="max-w-3xl text-base font-medium text-slate-500">
            Gestão de departamentos e identidades corporativas.
          </p>
        </div>

        {canCreateTeam ? (
          <Link href="/painel/equipes/novo" className="button-primary">
            <Plus className="size-4" />
            Nova Equipe
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
            placeholder="Buscar equipe..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>
      </form>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.3fr_0.55fr_0.55fr_0.55fr_0.45fr] gap-4 border-b border-slate-100 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 md:grid">
          <span>Equipe / Identificador</span>
          <span>Status</span>
          <span className="text-center">Membros</span>
          <span className="text-center">Branding</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {teams.map((team) => {
            const hasBranding = Boolean(team.brandingSettings);

            return (
              <article
                key={team.id}
                className="grid gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60 md:grid-cols-[1.3fr_0.55fr_0.55fr_0.55fr_0.45fr] md:items-center md:px-8"
              >
                <div className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                    <ShieldCheck className="size-5" />
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-slate-900">{team.name}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">/{team.slug}</p>
                  </div>
                </div>

                <div>
                  <span
                    className={
                      team.isActive
                        ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700"
                        : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"
                    }
                  >
                    {team.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 md:justify-center">
                  <Users className="size-4 text-slate-300" />
                  {team.memberships.length}
                </div>

                <div className="text-sm font-semibold text-slate-400 md:text-center">
                  {hasBranding ? (
                    <span className="inline-flex items-center justify-center text-blue-600">
                      <Palette className="size-4" />
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">
                      Padrão
                    </span>
                  )}
                </div>

                <div className="flex md:justify-end">
                  <Link
                    href={`/painel/equipes/${team.id}/editar`}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
                  >
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>
              </article>
            );
          })}

          {teams.length === 0 ? (
            <div className="px-8 py-10 text-sm text-slate-500">
              Nenhuma equipe encontrada neste contexto.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
