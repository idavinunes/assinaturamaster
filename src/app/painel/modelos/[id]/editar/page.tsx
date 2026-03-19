import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileCode2, FileText, Globe2, Shapes, ShieldCheck, Variable } from "lucide-react";
import { DeleteTemplateButton } from "@/components/delete-template-button";
import { TemplateForm } from "@/components/template-form";
import { requireAccessContext } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import {
  buildTemplateScopeWhere,
  canCreateGlobalTemplates,
  canDeleteTemplate,
  canEditTemplate,
} from "@/lib/template-access";
import {
  countTemplateVariables,
  formatTemplateTeamAccessSummary,
  stringifyTemplateVariables,
  templateScopeLabels,
  templateStatusLabels,
} from "@/lib/templates";

export const dynamic = "force-dynamic";

type EditTemplatePageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function EditTemplatePage({
  params,
  searchParams,
}: EditTemplatePageProps) {
  const access = await requireAccessContext();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const error = resolvedSearchParams?.error;

  const template = await prisma.contractTemplate.findFirst({
    where: buildTemplateScopeWhere(access, { id }),
    select: {
      id: true,
      scope: true,
      ownerTeamId: true,
      name: true,
      description: true,
      version: true,
      body: true,
      variableSchema: true,
      sourceFileName: true,
      sourceStoragePath: true,
      status: true,
      ownerTeam: {
        select: {
          name: true,
        },
      },
      teamAccesses: {
        select: {
          teamId: true,
          team: {
            select: {
              name: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          team: {
            name: "asc",
          },
        },
      },
      _count: {
        select: {
          signatureRequests: true,
        },
      },
    },
  });

  if (!template) {
    notFound();
  }

  if (!canEditTemplate(access, template)) {
    redirect("/painel/modelos");
  }

  const canCreateGlobal = canCreateGlobalTemplates(access);
  const teams = canCreateGlobal
    ? await prisma.team.findMany({
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      })
    : [];

  const scopeOptions = [];

  if (template.scope === "TEAM_PRIVATE") {
    scopeOptions.push({
      value: "TEAM_PRIVATE" as const,
      label: `${templateScopeLabels.TEAM_PRIVATE} (${template.ownerTeam?.name ?? "equipe dona"})`,
    });
  } else if (access.activeTeamId) {
    scopeOptions.push({
      value: "TEAM_PRIVATE" as const,
      label: `${templateScopeLabels.TEAM_PRIVATE} (${access.activeTeam?.teamName ?? "equipe ativa"})`,
    });
  }

  scopeOptions.push({
    value: "GLOBAL" as const,
    label: templateScopeLabels.GLOBAL,
  });

  const ownerTeamForEdit =
    template.scope === "TEAM_PRIVATE" && template.ownerTeamId
      ? {
          id: template.ownerTeamId,
          name: template.ownerTeam?.name ?? "Equipe dona",
        }
      : access.activeTeamId
        ? {
            id: access.activeTeamId,
            name: access.activeTeam?.teamName ?? "Equipe ativa",
          }
        : null;

  const allowedTeamIds = template.teamAccesses.map((accessItem) => accessItem.teamId);
  const allowedTeamNames = template.teamAccesses.map((accessItem) => accessItem.team.name);

  const scopeField = canCreateGlobal
    ? {
        mode: "select" as const,
        value: template.scope,
        options: scopeOptions,
        helper:
          template.scope === "GLOBAL"
            ? "Alteracoes em modelo global impactam todas as equipes que usam este contrato."
            : "Modelos restritos mantem a equipe dona para edicao e podem liberar uso para outras equipes especificas.",
      }
    : {
        mode: "hidden" as const,
        value: template.scope,
        lockedLabel:
          template.scope === "GLOBAL"
            ? templateScopeLabels.GLOBAL
            : `${templateScopeLabels.TEAM_PRIVATE} (${template.ownerTeam?.name ?? "equipe dona"})`,
        helper:
          template.scope === "GLOBAL"
            ? "Modelos globais so podem ser ajustados pelo super admin."
            : "Este modelo permanece restrito para a equipe dona.",
      };

  const allowedTeamsField = canCreateGlobal
    ? ownerTeamForEdit
      ? {
          mode: "multi-select" as const,
          ownerTeam: {
            id: ownerTeamForEdit.id,
            label: ownerTeamForEdit.name,
          },
          options: teams
            .filter((team) => team.id !== ownerTeamForEdit.id)
            .map((team) => ({
              value: team.id,
              label: team.isActive ? team.name : `${team.name} • inativa`,
            })),
          helper:
            "A equipe dona continua com edicao. Marque as equipes extras que poderao usar este modelo.",
        }
      : undefined
    : {
        mode: "hidden" as const,
        lockedLabel: formatTemplateTeamAccessSummary(
          allowedTeamNames.length > 0
            ? allowedTeamNames
            : [template.ownerTeam?.name ?? "Equipe dona"],
        ),
        helper: "As equipes autorizadas so podem usar o modelo; a edicao continua na equipe dona.",
      };

  const totalVariables = countTemplateVariables(template.variableSchema);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          <Link href="/painel/modelos" className="transition hover:text-accent">
            Modelos
          </Link>
          <span>/</span>
          <span className="text-slate-900">Edicao</span>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {template.name}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Ajuste metadados, visibilidade e a fonte do contrato antes de publicar
              novas assinaturas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
              v{template.version}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
              {templateStatusLabels[template.status]}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
              {templateScopeLabels[template.scope]}
            </span>
            {template.sourceStoragePath ? (
              <Link
                href={`/editor/modelos/${template.id}`}
                className="button-primary button-primary-sm"
              >
                <FileCode2 className="size-4" />
                Abrir editor DOC
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.08fr_0.72fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="eyebrow text-slate-400">Configuracao do modelo</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Metadados e variaveis
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            O formulario abaixo controla nome, status, escopo, fonte DOCX e o mapa
            de variaveis disponiveis para o contrato.
          </p>

          <TemplateForm
            actionUrl={`/painel/modelos/${template.id}/submit`}
            submitLabel="Salvar alteracoes"
            pendingLabel="Salvando..."
            error={error}
            scopeField={scopeField}
            defaults={{
              name: template.name,
              description: template.description,
              version: template.version,
              body: template.body,
              variableSchemaInput: stringifyTemplateVariables(template.variableSchema),
              status: template.status,
              scope: template.scope,
              allowedTeamIds,
              sourceFileName: template.sourceFileName,
              sourceStoragePath: template.sourceStoragePath,
            }}
            allowedTeamsField={allowedTeamsField}
          />
        </section>

        <aside className="space-y-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Resumo tecnico</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                <div className="flex items-center gap-2 text-slate-900">
                  {template.scope === "GLOBAL" ? (
                    <Globe2 className="size-4 text-accent" />
                  ) : (
                    <Shapes className="size-4 text-accent" />
                  )}
                  <p className="font-semibold">{templateScopeLabels[template.scope]}</p>
                </div>
                <p className="mt-2 leading-6">
                  {template.scope === "GLOBAL"
                    ? "Disponivel para todas as equipes que usam contratos globais."
                    : `Disponivel para ${formatTemplateTeamAccessSummary(
                        allowedTeamNames.length > 0
                          ? allowedTeamNames
                          : [template.ownerTeam?.name ?? "equipe dona"],
                      )}.`}
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                <div className="flex items-center gap-2 text-slate-900">
                  <Variable className="size-4 text-accent" />
                  <p className="font-semibold">{totalVariables} variavel(is)</p>
                </div>
                <p className="mt-2 leading-6">
                  {template._count.signatureRequests} solicitacao(oes) ja vinculada(s) a este modelo.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="eyebrow text-slate-400">Fonte do contrato</p>
            {template.sourceStoragePath ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2 text-slate-900">
                    <FileCode2 className="size-4 text-accent" />
                    <p className="font-semibold">DOCX principal ativo</p>
                  </div>
                  <p className="mt-2 leading-6">
                    {template.sourceFileName} esta pronto para edicao visual na rota dedicada.
                  </p>
                </div>
                <Link
                  href={`/editor/modelos/${template.id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FileCode2 className="mr-2 size-4" />
                  Abrir editor DOC
                </Link>
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                <div className="flex items-center gap-2 text-slate-900">
                  <FileText className="size-4 text-accent" />
                  <p className="font-semibold">Conteudo textual</p>
                </div>
                <p className="mt-2 leading-6">
                  Este modelo ainda usa o corpo textual do proprio cadastro. Envie um `.docx`
                  para migrar o fluxo para o editor DOC.
                </p>
              </div>
            )}
          </section>

          {canDeleteTemplate(access, template) ? (
            <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4">
              <p className="text-sm font-semibold text-rose-900">Apagar modelo</p>
              <p className="mt-2 text-sm leading-6 text-rose-800">
                O super admin pode remover este modelo enquanto ele nao estiver vinculado a solicitacoes.
              </p>
              <p className="mt-2 text-sm leading-6 text-rose-800">
                Uso atual: {template._count.signatureRequests} solicitacao(oes).
              </p>
              <div className="mt-4">
                <DeleteTemplateButton
                  templateId={template.id}
                  confirmMessage="Deseja apagar este modelo? Se ele ja estiver vinculado a solicitacoes, o sistema vai bloquear a exclusao."
                  className="inline-flex items-center rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </section>
          ) : (
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-500 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <ShieldCheck className="size-4 text-accent" />
                <p className="font-semibold">Regra aplicada</p>
              </div>
              <p className="mt-2">
                A exclusao segue restrita ao super admin e depende de nao haver uso
                ativo do modelo em solicitacoes de assinatura.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
