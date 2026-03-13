import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OnlyOfficeTemplateEditor } from "@/components/onlyoffice-template-editor";
import { TemplateVariableLibrary } from "@/components/template-variable-library";
import { requireAccessContext } from "@/lib/access-control";
import {
  buildOnlyOfficeTemplateEditorConfig,
  getOnlyOfficeEditorEnvironmentIssue,
  getOnlyOfficeUrl,
} from "@/lib/onlyoffice";
import { prisma } from "@/lib/prisma";
import { buildTemplateScopeWhere, canEditTemplate } from "@/lib/template-access";
import { buildTemplateEditorVariableGroups } from "@/lib/templates";

export const dynamic = "force-dynamic";

type DedicatedTemplateEditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DedicatedTemplateEditorPage({
  params,
}: DedicatedTemplateEditorPageProps) {
  const session = await requireAccessContext();
  const { id } = await params;

  const template = await prisma.contractTemplate.findFirst({
    where: buildTemplateScopeWhere(session, { id }),
    select: {
      id: true,
      name: true,
      scope: true,
      ownerTeamId: true,
      updatedAt: true,
      variableSchema: true,
      sourceFileName: true,
      sourceStoragePath: true,
    },
  });

  if (!template) {
    notFound();
  }

  if (!canEditTemplate(session, template)) {
    redirect("/painel/modelos");
  }

  if (!template.sourceStoragePath) {
    return (
      <main className="px-4 py-4 md:px-6">
        <section className="panel mx-auto min-h-[calc(100vh-2rem)] max-w-[1600px] rounded-[32px] p-6 md:p-8">
          <Link href={`/painel/modelos/${template.id}/editar`} className="eyebrow text-muted">
            voltar para o modelo
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Editor DOC indisponivel
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Envie primeiro um arquivo `.docx` no cadastro do modelo para abrir a edicao
            visual no ONLYOFFICE.
          </p>
        </section>
      </main>
    );
  }

  const environmentIssue = getOnlyOfficeEditorEnvironmentIssue();

  if (environmentIssue) {
    return (
      <main className="px-4 py-4 md:px-6">
        <section className="panel mx-auto min-h-[calc(100vh-2rem)] max-w-[1600px] rounded-[32px] p-6 md:p-8">
          <Link href={`/painel/modelos/${template.id}/editar`} className="eyebrow text-muted">
            voltar para o modelo
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Editor DOC indisponivel neste ambiente
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            {environmentIssue.message}
          </p>

          <div className="mt-8 rounded-[28px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold text-amber-900">Causa atual</p>
            <p className="mt-3 text-sm leading-6 text-amber-800">
              `APP_URL` esta em <span className="font-mono">{environmentIssue.appUrl}</span>,
              enquanto o servidor do ONLYOFFICE esta em{" "}
              <span className="font-mono">{environmentIssue.onlyOfficeUrl}</span>. Como o
              servidor do ONLYOFFICE e remoto, ele nao consegue acessar `localhost` para
              baixar o arquivo do modelo nem chamar o callback de salvamento.
            </p>
            <p className="mt-4 text-sm leading-6 text-amber-800">
              Para funcionar, exponha esta aplicacao em uma URL publica e atualize o
              `APP_URL`.
            </p>
          </div>
        </section>
      </main>
    );
  }

  let documentServerUrl: string;
  let editorConfig: Record<string, unknown>;
  let editorToken: string;

  try {
    documentServerUrl = getOnlyOfficeUrl();
    const builtConfig = await buildOnlyOfficeTemplateEditorConfig({
      templateId: template.id,
      templateName: template.name,
      sourceFileName: template.sourceFileName,
      updatedAt: template.updatedAt,
      user: {
        id: session.id,
        name: session.name,
      },
    });
    editorConfig = builtConfig.config;
    editorToken = builtConfig.token;
  } catch (error) {
    return (
      <main className="px-4 py-4 md:px-6">
        <section className="panel mx-auto min-h-[calc(100vh-2rem)] max-w-[1600px] rounded-[32px] p-6 md:p-8">
          <Link href={`/painel/modelos/${template.id}/editar`} className="eyebrow text-muted">
            voltar para o modelo
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            ONLYOFFICE nao configurado
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-red-700">
            {error instanceof Error ? error.message : "Nao foi possivel montar o editor."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="px-2 py-2 md:px-3">
      <section className="panel mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1920px] flex-col rounded-[28px] p-3 md:p-4">
        <div className="flex flex-col gap-3 border-b border-line px-2 pb-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link href={`/painel/modelos/${template.id}/editar`} className="eyebrow text-muted">
              voltar para o modelo
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Editor DOC do modelo
            </h1>
          </div>

          <div className="rounded-[20px] border border-line bg-white/70 px-4 py-3 text-sm text-muted">
            <p className="truncate font-semibold text-foreground">{template.name}</p>
            <p className="mt-1 truncate">{template.sourceFileName}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-line bg-white/70 px-4 py-3">
          <p className="text-sm leading-6 text-muted">
            Use a biblioteca para copiar placeholders como{" "}
            <span className="font-mono text-foreground">{`{{client_display_name}}`}</span> e{" "}
            <span className="font-mono text-foreground">{`{{service_prestation_amount_formatted}}`}</span>.
          </p>
          <TemplateVariableLibrary
            groups={buildTemplateEditorVariableGroups(template.variableSchema)}
          />
        </div>

        <div className="mt-3 flex-1 overflow-hidden rounded-[24px] border border-line bg-white">
          <OnlyOfficeTemplateEditor
            documentServerUrl={documentServerUrl}
            config={editorConfig}
            token={editorToken}
            className="h-[calc(100vh-7.5rem)] min-h-[860px] w-full overflow-hidden bg-stone-950"
          />
        </div>
      </section>
    </main>
  );
}
