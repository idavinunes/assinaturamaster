import Link from "next/link";
import { ShieldCheck, Users2 } from "lucide-react";
import { UserForm } from "@/components/user-form";
import { createUserAction } from "@/app/painel/usuarios/actions";
import { getAdminRoles, requireRole } from "@/lib/auth";
import { roleOptions } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const session = await requireRole(getAdminRoles());
  const teams = await prisma.team.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/painel/usuarios" className="eyebrow text-muted">
          voltar para usuarios
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Criar usuario
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            Cadastre um novo acesso global e, se fizer sentido, ja vincule o usuario
            a uma equipe operacional para que ele entre no painel com contexto definido.
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.72fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="eyebrow text-slate-400">Novo acesso</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Conta e nivel de entrada
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            O papel global define o alcance administrativo. O vinculo inicial com equipe
            continua opcional e pode ser ajustado depois na edicao do perfil.
          </p>

          <UserForm
            action={createUserAction}
            submitLabel="Criar usuario"
            pendingLabel="Criando..."
            defaults={{
              role: roleOptions[3]?.value,
              initialTeamId: session.activeTeamId ?? "",
              initialTeamRole: "OPERATOR",
            }}
            teamOptions={teams}
          />
        </section>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Contexto de criacao</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
              Equipe sugerida
            </h2>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Users2 className="size-4 text-accent" />
                  Equipes ativas
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {teams.length}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  ambientes disponiveis para vinculo imediato
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Equipe ativa atual
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {session.activeTeam?.teamName ?? "Sem equipe ativa"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {session.activeTeam
                    ? `${session.activeTeam.role.toLowerCase()} na equipe selecionada`
                    : "o usuario pode nascer sem equipe e ser vinculado depois"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Regra aplicada</p>
            <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
              <div className="flex items-center gap-2 text-slate-900">
                <ShieldCheck className="size-4 text-accent" />
                <p className="font-semibold">Criacao segura</p>
              </div>
              <p className="mt-2">
                Nome, e-mail, senha inicial e papel global sao obrigatorios. O vinculo
                com equipe pode ser criado agora ou depois, sem perder governanca.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
