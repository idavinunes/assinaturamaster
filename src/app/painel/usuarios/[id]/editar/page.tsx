import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserForm } from "@/components/user-form";
import { UserTeamMembershipCreateForm } from "@/components/user-team-membership-create-form";
import { UserTeamMembershipEditForm } from "@/components/user-team-membership-edit-form";
import { UserPortfolioManagementForm } from "@/components/user-portfolio-management-form";
import {
  createUserMembershipAction,
  updateUserAction,
  updateUserMembershipAction,
} from "@/app/painel/usuarios/actions";
import { getAdminRoles, requireRole } from "@/lib/auth";
import { getPortfolioSummaryByTeamForUser } from "@/lib/portfolio-management";
import { prisma } from "@/lib/prisma";
import { roleLabels, teamMemberRoleLabels } from "@/lib/roles";
import { listAssignableTeamMembers } from "@/lib/team-members";

export const dynamic = "force-dynamic";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const session = await requireRole(getAdminRoles());
  const { id } = await params;

  const [user, portfolioByTeam, assignableMembers, availableTeams] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        teamMemberships: {
          orderBy: [{ isActive: "desc" }, { team: { name: "asc" } }],
          select: {
            id: true,
            role: true,
            isActive: true,
            teamId: true,
            team: {
              select: {
                name: true,
                slug: true,
                isActive: true,
              },
            },
          },
        },
      },
    }),
    getPortfolioSummaryByTeamForUser(id),
    session.activeTeamId ? listAssignableTeamMembers(session.activeTeamId) : Promise.resolve([]),
    prisma.team.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
  ]);

  if (!user) {
    notFound();
  }

  const activeTeamPortfolio = portfolioByTeam.find(
    (portfolio) => portfolio.teamId === session.activeTeamId,
  );
  const activeTeamMembership = user.teamMemberships.find(
    (membership) => membership.teamId === session.activeTeamId,
  );
  const targetMembers = assignableMembers.filter((member) => member.userId !== user.id);
  const linkedTeamIds = new Set(user.teamMemberships.map((membership) => membership.teamId));
  const teamOptions = availableTeams.filter((team) => !linkedTeamIds.has(team.id));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <span className="flex size-16 items-center justify-center rounded-[24px] bg-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-500/20">
            {getInitials(user.name)}
          </span>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <Link href="/painel/usuarios" className="transition hover:text-blue-600">
                Usuarios
              </Link>
              <span>/</span>
              <span className="text-slate-900">Perfil</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">{user.name}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
                {roleLabels[user.role as keyof typeof roleLabels]}
              </span>
              <span
                className={clsx(
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                  user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                )}
              >
                {user.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Dados de acesso</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Conta e papel global
            </h2>
            <UserForm
              action={updateUserAction.bind(null, user.id)}
              submitLabel="Salvar alterações"
              pendingLabel="Salvando..."
              isEdit
              defaults={{
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
              }}
            />
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="eyebrow text-slate-400">Equipes vinculadas</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  Contextos de atuação
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Vincule novas equipes e ajuste o papel operacional do usuário sem sair da tela.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 px-5 py-5">
              <p className="text-sm font-semibold text-slate-900">Vincular nova equipe</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Escolha uma equipe ativa e o papel inicial desse usuário dentro do ambiente.
              </p>

              <div className="mt-4">
                {teamOptions.length > 0 ? (
                  <UserTeamMembershipCreateForm
                    action={createUserMembershipAction.bind(null, user.id)}
                    teams={teamOptions}
                  />
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    Este usuário já possui vínculo com todas as equipes ativas cadastradas.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {user.teamMemberships.length > 0 ? (
                user.teamMemberships.map((membership) => (
                  <UserTeamMembershipEditForm
                    key={membership.id}
                    action={updateUserMembershipAction.bind(null, user.id, membership.id)}
                    membership={{
                      teamId: membership.teamId,
                      teamName: membership.team.name,
                      teamSlug: membership.team.slug,
                      teamIsActive: membership.team.isActive,
                      role: membership.role,
                      isActive: membership.isActive,
                    }}
                  />
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 md:col-span-2">
                  Este usuário ainda não possui vínculos de equipe.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Carteira vinculada</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
              Distribuição por equipe
            </h2>

            <div className="mt-5 grid gap-3">
              {portfolioByTeam.length > 0 ? (
                portfolioByTeam.map((portfolio) => (
                  <div
                    key={portfolio.teamId}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm"
                  >
                    <p className="font-semibold text-slate-900">{portfolio.teamName}</p>
                    <p className="mt-2 leading-6 text-slate-500">
                      {portfolio.clientsCount} cliente(s) • {portfolio.executedServicesCount} serviço(s)
                      {" "}executado(s) • {portfolio.signatureRequestsCount} assinatura(s)
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Este usuário não possui carteira pendente.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Ação na equipe ativa</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
              Redistribuição operacional
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Antes de inativar ou remover este membro, transfira a carteira para outro responsável
              ou deixe os registros na fila sem responsável.
            </p>

            {session.activeTeam && activeTeamPortfolio ? (
              <div className="mt-5">
                <UserPortfolioManagementForm
                  userId={user.id}
                  teamName={session.activeTeam.teamName}
                  summary={activeTeamPortfolio}
                  assignableMembers={targetMembers}
                />
              </div>
            ) : session.activeTeam ? (
              <div className="mt-5 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Nenhuma carteira pendente em {session.activeTeam.teamName}.
              </div>
            ) : (
              <div className="mt-5 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Selecione uma equipe ativa para redistribuir a carteira.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Resumo rápido</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Equipes ativas
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {user.teamMemberships.filter((membership) => membership.isActive).length}
                </p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Papel na equipe ativa
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {activeTeamMembership
                    ? teamMemberRoleLabels[activeTeamMembership.role]
                    : "Sem equipe ativa"}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
