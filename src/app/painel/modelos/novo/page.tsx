import Link from "next/link";
import { TemplateForm } from "@/components/template-form";
import { redirect } from "next/navigation";
import { FolderCode, Globe2, Shapes, ShieldCheck } from "lucide-react";
import { requireAccessContext } from "@/lib/access-control";
import {
  canCreateGlobalTemplates,
  canManageTemplates,
} from "@/lib/template-access";
import { templateScopeLabels } from "@/lib/templates";

export const dynamic = "force-dynamic";

type NewTemplatePageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewTemplatePage({ searchParams }: NewTemplatePageProps) {
  const access = await requireAccessContext();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const error = resolvedSearchParams?.error;

  if (!canManageTemplates(access)) {
    redirect("/painel/modelos");
  }

  const scopeField = canCreateGlobalTemplates(access)
    ? {
        mode: "select" as const,
        value: access.activeTeamId ? ("TEAM_PRIVATE" as const) : ("GLOBAL" as const),
        options: access.activeTeamId
          ? [
              { value: "TEAM_PRIVATE" as const, label: `${templateScopeLabels.TEAM_PRIVATE} (${access.activeTeam?.teamName})` },
              { value: "GLOBAL" as const, label: templateScopeLabels.GLOBAL },
            ]
          : [{ value: "GLOBAL" as const, label: templateScopeLabels.GLOBAL }],
        helper: access.activeTeamId
          ? "Modelos privados ficam restritos a equipe ativa. Somente o super admin pode publicar um modelo global."
          : "Sem equipe ativa, o cadastro fica limitado ao escopo global.",
      }
    : {
        mode: "hidden" as const,
        value: "TEAM_PRIVATE" as const,
        lockedLabel: `${templateScopeLabels.TEAM_PRIVATE} (${access.activeTeam?.teamName ?? "equipe ativa"})`,
        helper: "O modelo novo nasce privado e fica disponivel apenas para a equipe ativa.",
      };

  return (
    <div>
      <Link href="/painel/modelos" className="eyebrow text-muted">
        voltar para modelos
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Criar modelo
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Cadastre a estrutura do contrato, defina as variaveis e publique a versao
        inicial do template. Se enviar um `.docx`, ele vira a fonte oficial do
        contrato e depois de salvar voce sera levado direto para o editor DOC.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <section className="rounded-[28px] bg-white/70 p-6">
          <p className="eyebrow text-muted">Estrutura do contrato</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            Versao inicial do modelo
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Preencha os metadados do contrato, escolha o escopo e vincule a fonte
            do documento. O formulario abaixo continua respeitando o fluxo real de
            DOCX/ONLYOFFICE do sistema.
          </p>

          <TemplateForm
            actionUrl="/painel/modelos/novo/submit"
            submitLabel="Criar modelo"
            pendingLabel="Criando..."
            error={error}
            scopeField={scopeField}
            defaults={{ version: 1, status: "DRAFT", scope: scopeField.value }}
          />
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[28px] bg-white/70 p-6">
            <p className="eyebrow text-muted">Escopo inicial</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-muted">
                <div className="flex items-center gap-2 text-foreground">
                  {scopeField.value === "GLOBAL" ? (
                    <Globe2 className="size-4 text-accent" />
                  ) : (
                    <Shapes className="size-4 text-accent" />
                  )}
                  <p className="font-semibold">
                    {scopeField.value === "GLOBAL" ? "Modelo global" : "Modelo da equipe"}
                  </p>
                </div>
                <p className="mt-2">{scopeField.helper}</p>
              </div>
              <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-muted">
                <div className="flex items-center gap-2 text-foreground">
                  <FolderCode className="size-4 text-accent" />
                  <p className="font-semibold">Editor DOC opcional</p>
                </div>
                <p className="mt-2">
                  Ao enviar um `.docx`, ele se torna a fonte principal do contrato e
                  o sistema leva voce ao editor DOC no passo seguinte.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-line bg-white/60 p-5 text-sm leading-6 text-muted">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="size-4 text-accent" />
              <p className="font-semibold">Regra aplicada</p>
            </div>
            <p className="mt-2">
              Modelos globais impactam todas as equipes. Modelos privados seguem a
              equipe ativa e herdam o escopo operacional do ambiente atual.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
