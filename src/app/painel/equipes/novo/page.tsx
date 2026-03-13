import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { canManageGlobalAdministration, requireAccessContext } from "@/lib/access-control";
import { TeamForm } from "@/components/team-form";
import { createTeamAction } from "@/app/painel/equipes/actions";

export const dynamic = "force-dynamic";

export default async function NewTeamPage() {
  const actor = await requireAccessContext();

  if (!canManageGlobalAdministration(actor)) {
    redirect("/painel/equipes");
  }

  return (
    <div>
      <Link href="/painel/equipes" className="eyebrow text-muted">
        voltar para equipes
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Nova equipe
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Crie um novo ambiente operacional. O usuario que cria a equipe ja entra
        como administrador desse contexto para iniciar a distribuicao dos membros.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <section className="rounded-[28px] bg-white/70 p-6">
          <p className="eyebrow text-muted">Identidade do ambiente</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            Dados iniciais da equipe
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Defina um nome claro, um identificador unico e uma descricao curta para
            facilitar a leitura do ambiente no painel.
          </p>

          <TeamForm
            action={createTeamAction}
            submitLabel="Criar equipe"
            pendingLabel="Criando..."
          />
        </section>

        <aside className="rounded-[28px] bg-white/70 p-6">
          <p className="eyebrow text-muted">Governanca inicial</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            O que acontece depois
          </h2>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-muted">
              O criador da equipe entra automaticamente como administrador do novo
              ambiente.
            </div>
            <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-muted">
              A distribuicao de membros, clientes e branding especifico continua na
              etapa seguinte.
            </div>
            <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-muted">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="size-4 text-accent" />
                <p className="font-semibold">Regra aplicada</p>
              </div>
              <p className="mt-2">
                Apenas administradores globais podem criar novas equipes.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
