import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, FileSignature, Palette, ShieldCheck, Users } from "lucide-react";
import { TeamForm } from "@/components/team-form";
import { TeamMemberCreateForm } from "@/components/team-member-create-form";
import { TeamMemberEditForm } from "@/components/team-member-edit-form";
import {
  createTeamMembershipAction,
  updateTeamAction,
  updateTeamMembershipAction,
} from "@/app/painel/equipes/actions";
import { prisma } from "@/lib/prisma";
import {
  buildManagedTeamsWhere,
  canEditTeamMetadata,
  canManageTeam,
  requireTeamManagementAccess,
} from "@/lib/team-access";
import { teamMemberRoleLabels } from "@/lib/roles";

export const dynamic = "force-dynamic";

type EditTeamPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTeamPage({ params }: EditTeamPageProps) {
  const actor = await requireTeamManagementAccess();
  const { id } = await params;

  const team = await prisma.team.findFirst({
    where: buildManagedTeamsWhere(actor, { id }),
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      brandingSettings: {
        select: {
          id: true,
        },
      },
      memberships: {
        orderBy: [{ isActive: "desc" }, { user: { name: "asc" } }],
        select: {
          id: true,
          userId: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          clients: true,
          executedServices: true,
          signatureRequests: true,
        },
      },
    },
  });

  if (!team || !canManageTeam(actor, id)) {
    notFound();
  }

  const activeMemberUserIds = team.memberships
    .filter((membership) => membership.isActive)
    .map((membership) => membership.userId);

  const availableUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      id: {
        notIn: activeMemberUserIds,
      },
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const canEditMetadataSection = canEditTeamMetadata(actor);
  const activeMembersCount = team.memberships.filter((membership) => membership.isActive).length;
  const pausedMembersCount = team.memberships.length - activeMembersCount;
  const hasCustomBranding = Boolean(team.brandingSettings);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          <Link href="/painel/equipes" className="transition hover:text-accent">
            Equipes
          </Link>
          <span>/</span>
          <span className="text-slate-900">Editar</span>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {team.name}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Ajuste os dados estruturais da equipe e distribua quem opera dentro
              desse ambiente sem sair do mesmo contexto.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
              /{team.slug}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
              {team.isActive ? "Equipe ativa" : "Equipe inativa"}
            </span>
            {actor.activeTeamId === team.id && actor.activeTeam ? (
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                Equipe ativa • {teamMemberRoleLabels[actor.activeTeam.role]}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Dados da unidade</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Identidade da equipe
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Nome, slug e status seguem a governanca do ambiente. A descricao
              ajuda a leitura interna e aparece no contexto administrativo.
            </p>

            {canEditMetadataSection ? (
              <TeamForm
                action={updateTeamAction.bind(null, team.id)}
                submitLabel="Salvar equipe"
                pendingLabel="Salvando..."
                isEdit
                defaults={{
                  name: team.name,
                  slug: team.slug,
                  description: team.description,
                  isActive: team.isActive,
                }}
              />
            ) : (
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Identificador
                  </p>
                  <p className="mt-2 font-mono text-sm text-slate-900">/{team.slug}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Status
                  </p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {team.isActive ? "Ativa" : "Inativa"}
                  </p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500 md:col-span-2">
                  {team.description || "Sem descricao operacional cadastrada."}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow text-slate-400">Membros</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  Gestao de acesso
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Vincule usuarios ao ambiente, ajuste papeis internos e pause um
                  vinculo sem apagar o historico operacional.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 px-5 py-5">
              <p className="text-sm font-semibold text-slate-900">Adicionar ou reativar membro</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                O usuario precisa existir no cadastro global antes de entrar em uma
                equipe. Se houver um vinculo anterior, o sistema reativa o mesmo registro.
              </p>

              <div className="mt-4">
                {availableUsers.length > 0 ? (
                  <TeamMemberCreateForm
                    action={createTeamMembershipAction.bind(null, team.id)}
                    users={availableUsers}
                  />
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    Todos os usuarios ativos ja possuem vinculo ativo com esta equipe.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {team.memberships.map((membership) => (
                <TeamMemberEditForm
                  key={membership.id}
                  action={updateTeamMembershipAction.bind(null, team.id, membership.id)}
                  membership={{
                    userName: membership.user.name,
                    userEmail: membership.user.email,
                    userRole: membership.user.role,
                    role: membership.role,
                    isActive: membership.isActive,
                    createdAt: membership.createdAt,
                    updatedAt: membership.updatedAt,
                  }}
                />
              ))}

              {team.memberships.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Esta equipe ainda nao possui membros vinculados.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Resumo operacional</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
              Volume atual
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Users className="size-4 text-accent" />
                  Membros
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {activeMembersCount}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {pausedMembersCount > 0
                    ? `${pausedMembersCount} vinculo(s) pausado(s)`
                    : "todos os vinculos ativos"}
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <BriefcaseBusiness className="size-4 text-accent" />
                  Clientes
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {team._count.clients}
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Users className="size-4 text-accent" />
                  Servicos
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {team._count.executedServices}
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <FileSignature className="size-4 text-accent" />
                  Assinaturas
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {team._count.signatureRequests}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Governanca</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                <div className="flex items-center gap-2 text-slate-900">
                  <Palette className="size-4 text-accent" />
                  <p className="font-semibold">
                    {hasCustomBranding ? "Branding proprio ativo" : "Branding global herdado"}
                  </p>
                </div>
                <p className="mt-2 leading-6">
                  A marca da equipe continua centralizada em configuracoes. Se nao houver
                  sobrescrita, o sistema usa o padrao global.
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                <div className="flex items-center gap-2 text-slate-900">
                  <ShieldCheck className="size-4 text-accent" />
                  <p className="font-semibold">Edicao de metadados</p>
                </div>
                <p className="mt-2 leading-6">
                  Nome, slug e status seguem a administracao global. Admins da equipe
                  mantem a gestao de membros e papeis operacionais.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
