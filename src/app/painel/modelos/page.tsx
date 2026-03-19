import clsx from "clsx";
import {
  ArrowUpRight,
  FileCode2,
  FileText,
  FolderCode,
  Globe2,
  Plus,
  ShieldCheck,
  Shapes,
} from "lucide-react";
import Link from "next/link";
import { DeleteTemplateButton } from "@/components/delete-template-button";
import { requireAccessContext } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import {
  buildTemplateScopeWhere,
  canDeleteTemplate,
  canEditTemplate,
  canManageTemplates,
} from "@/lib/template-access";
import {
  countTemplateVariables,
  formatTemplateTeamAccessSummary,
  templateScopeLabels,
  templateStatusLabels,
} from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const access = await requireAccessContext();
  const canManage = canManageTemplates(access);

  const templates = await prisma.contractTemplate.findMany({
    where: buildTemplateScopeWhere(access),
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      ownerTeam: {
        select: {
          name: true,
        },
      },
      teamAccesses: {
        select: {
          team: {
            select: {
              name: true,
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

  const totalTemplates = templates.length;
  const globalTemplates = templates.filter((template) => template.scope === "GLOBAL").length;
  const privateTemplates = totalTemplates - globalTemplates;
  const docxTemplates = templates.filter((template) => Boolean(template.sourceStoragePath)).length;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-muted">Modelos</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Modelos de contrato
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Estruture contratos reutilizaveis com versao, variaveis dinamicas,
            escopo global ou restrito por equipes e edicao visual em DOCX/ONLYOFFICE.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/painel/modelos/novo"
            className="button-primary"
          >
            <Plus className="size-4" />
            Novo modelo
          </Link>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[0.38fr_0.62fr]">
        <section className="rounded-[28px] bg-white/70 p-5">
          <p className="eyebrow text-muted">Panorama</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[24px] border border-line bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Modelos visiveis
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {totalTemplates}
              </p>
            </div>
            <div className="rounded-[24px] border border-line bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <Globe2 className="size-4 text-accent" />
                Globais
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {globalTemplates}
              </p>
            </div>
            <div className="rounded-[24px] border border-line bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <Shapes className="size-4 text-accent" />
                Restritos
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {privateTemplates}
              </p>
            </div>
            <div className="rounded-[24px] border border-line bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <FolderCode className="size-4 text-accent" />
                Fonte DOCX
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {docxTemplates}
              </p>
              <p className="mt-1 text-xs text-muted">
                {docxTemplates > 0
                  ? "Modelos com editor DOC habilitado."
                  : "Nenhum modelo com DOCX vinculado."}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white/70 p-4 md:p-6">
          <div className="hidden grid-cols-[1.3fr_0.7fr_0.8fr_0.95fr] gap-4 border-b border-line px-4 pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted md:grid">
            <span>Modelo</span>
            <span>Escopo</span>
            <span>Operacao</span>
            <span>Acoes</span>
          </div>

          <div className="grid gap-3 pt-3">
            {templates.map((template) => {
              const visibleTeamNames = template.teamAccesses.map((accessItem) => accessItem.team.name);

              return (
              <article
                key={template.id}
                className="grid gap-4 rounded-[24px] border border-line bg-white p-4 md:grid-cols-[1.3fr_0.7fr_0.8fr_0.95fr] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{template.name}</p>
                    <span className="inline-flex rounded-full border border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      v{template.version}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    atualizado em {template.updatedAt.toLocaleDateString("pt-BR")}
                  </p>
                  {template.scope === "TEAM_PRIVATE" ? (
                    <p className="mt-1 text-xs text-muted">
                      Equipes:{" "}
                      {formatTemplateTeamAccessSummary(
                        visibleTeamNames.length > 0
                          ? visibleTeamNames
                          : [template.ownerTeam?.name ?? "Equipe nao localizada"],
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 text-sm text-muted">
                  <span className="inline-flex w-fit rounded-full border border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {templateScopeLabels[template.scope]}
                  </span>
                  <div className="flex items-center gap-2">
                    {template.sourceStoragePath ? (
                      <>
                        <FolderCode className="size-4 text-accent" />
                        <span>Editor DOC</span>
                      </>
                    ) : (
                      <>
                        <FileText className="size-4 text-accent" />
                        <span>Texto legado</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-muted">
                  <span
                    className={clsx(
                      "inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium",
                      template.status === "ACTIVE" && "bg-emerald-50 text-emerald-700",
                      template.status === "DRAFT" && "bg-amber-50 text-amber-700",
                      template.status === "ARCHIVED" && "bg-stone-100 text-stone-600",
                    )}
                  >
                    {templateStatusLabels[template.status]}
                  </span>
                  <p>{countTemplateVariables(template.variableSchema)} variavel(is)</p>
                  <p>{template._count.signatureRequests} uso(s) em assinatura</p>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  {canManage && canEditTemplate(access, template) ? (
                    <>
                      <Link
                        href={`/painel/modelos/${template.id}/editar`}
                        className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-stone-50"
                      >
                        Editar
                        <ArrowUpRight className="ml-2 size-4" />
                      </Link>
                      {template.sourceStoragePath ? (
                        <Link
                          href={`/editor/modelos/${template.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-stone-50"
                        >
                          <FileCode2 className="mr-2 size-4" />
                          Editor
                        </Link>
                      ) : null}
                      {canDeleteTemplate(access, template) ? (
                        <DeleteTemplateButton
                          templateId={template.id}
                          label="Apagar"
                          pendingLabel="Apagando..."
                          confirmMessage="Deseja apagar este modelo? Se ele ja estiver vinculado a solicitacoes, o sistema vai bloquear a exclusao."
                          className="inline-flex items-center justify-center rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      ) : null}
                    </>
                  ) : (
                    <span className="text-sm text-muted">
                      {template.scope === "GLOBAL" ? "Uso global" : "Somente leitura"}
                    </span>
                  )}
                </div>
              </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-[28px] border border-line bg-white/60 p-5 text-sm leading-6 text-muted">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="size-4 text-accent" />
          <p className="font-semibold">Permissao aplicada</p>
        </div>
        <p className="mt-2">
          Modelos globais ficam visiveis para todas as equipes. Modelos restritos
          podem ser liberados para uma ou mais equipes especificas, mantendo uma
          equipe dona para edicao. A exclusao continua restrita ao super admin.
        </p>
      </div>
    </div>
  );
}
