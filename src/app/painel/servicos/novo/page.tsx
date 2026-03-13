import Link from "next/link";
import { ServiceForm } from "@/components/service-form";
import { createServiceCatalogAction } from "@/app/painel/servicos/actions";
import { serviceCatalogScopeLabels } from "@/lib/service-catalog";
import {
  canCreateGlobalServiceCatalog,
  requireServiceCatalogManageContext,
} from "@/lib/service-catalog-access";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const access = await requireServiceCatalogManageContext();

  const scopeField = canCreateGlobalServiceCatalog(access)
    ? {
        mode: "select" as const,
        value: access.activeTeamId ? ("TEAM_PRIVATE" as const) : ("GLOBAL" as const),
        options: access.activeTeamId
          ? [
              {
                value: "TEAM_PRIVATE" as const,
                label: `${serviceCatalogScopeLabels.TEAM_PRIVATE} (${access.activeTeam?.teamName})`,
              },
              { value: "GLOBAL" as const, label: serviceCatalogScopeLabels.GLOBAL },
            ]
          : [{ value: "GLOBAL" as const, label: serviceCatalogScopeLabels.GLOBAL }],
        helper: access.activeTeamId
          ? "Servicos privados ficam restritos a equipe ativa. Somente o super admin pode publicar um item global."
          : "Sem equipe ativa, o cadastro fica limitado ao escopo global.",
      }
    : {
        mode: "hidden" as const,
        value: "TEAM_PRIVATE" as const,
        lockedLabel: `${serviceCatalogScopeLabels.TEAM_PRIVATE} (${access.activeTeam?.teamName ?? "equipe ativa"})`,
        helper: "O servico novo nasce privado e fica disponivel apenas para a equipe ativa.",
      };

  return (
    <div>
      <Link href="/painel/servicos" className="eyebrow text-muted">
        voltar para servicos
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Criar servico
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Registre o servico base com descricao do evento, valor de evento e
        percentual de prestacao para uso nas futuras execucoes por cliente.
      </p>

      <div className="mt-8 rounded-[28px] bg-white/70 p-6">
        <ServiceForm
          action={createServiceCatalogAction}
          submitLabel="Criar servico"
          pendingLabel="Criando..."
          scopeField={scopeField}
          defaults={{ scope: scopeField.value }}
        />
      </div>
    </div>
  );
}
