import { Prisma, Role } from "@prisma/client";
import clsx from "clsx";
import { Mail, Plus, Search, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { getAdminRoles, requireRole } from "@/lib/auth";
import {
  getTeamPortfolioCountsByUser,
  getTeamUnassignedPortfolioSummary,
} from "@/lib/portfolio-management";
import { prisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/roles";
import { toggleUserStatusAction } from "@/app/painel/usuarios/actions";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requireRole(getAdminRoles());
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q?.trim() ?? "";

  const where: Prisma.UserWhereInput | undefined = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      }
    : undefined;

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          teamMemberships: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
  });
  const portfolioCountsByUser = session.activeTeamId
    ? await getTeamPortfolioCountsByUser(session.activeTeamId)
    : new Map();
  const unassignedPortfolio = session.activeTeamId
    ? await getTeamUnassignedPortfolioSummary(session.activeTeamId)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Usuários</h1>
          <p className="max-w-3xl text-base font-medium text-slate-500">
            Controle de acesso global e auditoria de carteira operacional.
          </p>
        </div>

        <Link href="/painel/usuarios/novo" className="button-primary">
          <Plus className="size-4" />
          Novo Usuário
        </Link>
      </div>

      <form className="max-w-sm">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Search className="size-4 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Filtrar usuários..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>
      </form>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.3fr_0.9fr_0.5fr_0.8fr_0.65fr_0.55fr] gap-4 border-b border-slate-100 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 md:grid">
          <span>Usuário</span>
          <span>Papel Global</span>
          <span className="text-center">Vínculos</span>
          <span>Status Carteira</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {users.map((user) => {
            const isSelf = user.id === session.id;
            const portfolioSummary = portfolioCountsByUser.get(user.id);
            const hasPendingPortfolio = Boolean(portfolioSummary?.totalCount);

            return (
              <article
                key={user.id}
                className="grid gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60 md:grid-cols-[1.3fr_0.9fr_0.5fr_0.8fr_0.65fr_0.55fr] md:items-center md:px-8"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
                    {getInitials(user.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Mail className="size-3" />
                      <span className="truncate">{user.email}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Shield className="size-3.5 text-blue-500" />
                  {roleLabels[user.role as keyof typeof roleLabels]}
                </div>

                <div className="text-center font-mono text-[11px] font-bold text-slate-400">
                  {user._count.teamMemberships}
                </div>

                <div
                  className={clsx(
                    "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                    hasPendingPortfolio ? "text-amber-500" : "text-slate-300",
                  )}
                >
                  <Wallet className="size-3.5" />
                  {hasPendingPortfolio ? "Pendente" : "Regular"}
                </div>

                <span
                  className={clsx(
                    "inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                    user.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {user.isActive ? "Ativo" : "Inativo"}
                </span>

                <div className="flex items-center justify-start gap-2 md:justify-end">
                  <Link
                    href={`/painel/usuarios/${user.id}/editar`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {hasPendingPortfolio ? "Gerir" : "Editar"}
                  </Link>

                  <form action={toggleUserStatusAction.bind(null, user.id)}>
                    <SubmitButton
                      pendingLabel="..."
                      disabled={isSelf || (user.isActive && hasPendingPortfolio)}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {user.isActive ? "Inativar" : "Reativar"}
                    </SubmitButton>
                  </form>
                </div>
              </article>
            );
          })}

          {users.length === 0 ? (
            <div className="px-8 py-10 text-sm text-slate-500">Nenhum usuário encontrado.</div>
          ) : null}
        </div>
      </section>

      <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4 text-sm leading-6 text-slate-500">
        Somente {roleLabels[Role.SUPER_ADMIN]} e {roleLabels[Role.ADMIN]} podem alterar usuários.
        {session.activeTeam && unassignedPortfolio && unassignedPortfolio.totalCount > 0 ? (
          <span>
            {" "}Na equipe ativa {session.activeTeam.teamName}, a fila sem responsável soma{" "}
            {unassignedPortfolio.clientsCount} cliente(s), {unassignedPortfolio.executedServicesCount} serviço(s)
            {" "}e {unassignedPortfolio.signatureRequestsCount} assinatura(s).
          </span>
        ) : null}
      </div>
    </div>
  );
}
