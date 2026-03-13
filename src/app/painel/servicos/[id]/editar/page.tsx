import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ServiceForm } from "@/components/service-form";
import { updateServiceCatalogAction } from "@/app/painel/servicos/actions";
import { prisma } from "@/lib/prisma";
import { serviceCatalogScopeLabels } from "@/lib/service-catalog";
import {
  buildServiceCatalogScopeWhere,
  canCreateGlobalServiceCatalog,
  canEditServiceCatalog,
  requireServiceCatalogAccessContext,
} from "@/lib/service-catalog-access";

export const dynamic = "force-dynamic";

type EditServicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditServicePage({ params }: EditServicePageProps) {
  const access = await requireServiceCatalogAccessContext();
  const { id } = await params;

  const service = await prisma.serviceCatalog.findFirst({
    where: buildServiceCatalogScopeWhere(access, { id }),
    select: {
      id: true,
      scope: true,
      ownerTeamId: true,
      name: true,
      description: true,
      defaultAmount: true,
      defaultPercentage: true,
      isActive: true,
      ownerTeam: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!service) {
    notFound();
  }

  if (!canEditServiceCatalog(access, service)) {
    redirect("/painel/servicos");
  }

  const scopeOptions = [];

  if (service.scope === "TEAM_PRIVATE") {
    scopeOptions.push({
      value: "TEAM_PRIVATE" as const,
      label: `${serviceCatalogScopeLabels.TEAM_PRIVATE} (${service.ownerTeam?.name ?? "equipe dona"})`,
    });
  } else if (access.activeTeamId) {
    scopeOptions.push({
      value: "TEAM_PRIVATE" as const,
      label: `${serviceCatalogScopeLabels.TEAM_PRIVATE} (${access.activeTeam?.teamName ?? "equipe ativa"})`,
    });
  }

  scopeOptions.push({
    value: "GLOBAL" as const,
    label: serviceCatalogScopeLabels.GLOBAL,
  });

  const scopeField = canCreateGlobalServiceCatalog(access)
    ? {
        mode: "select" as const,
        value: service.scope,
        options: scopeOptions,
        helper:
          service.scope === "GLOBAL"
            ? "Alteracoes em servico global impactam todas as equipes que usam este item."
            : "Servicos privados continuam limitados a equipe dona. Para mover de equipe, troque a equipe ativa antes da edicao.",
      }
    : {
        mode: "hidden" as const,
        value: service.scope,
        lockedLabel:
          service.scope === "GLOBAL"
            ? serviceCatalogScopeLabels.GLOBAL
            : `${serviceCatalogScopeLabels.TEAM_PRIVATE} (${service.ownerTeam?.name ?? "equipe dona"})`,
        helper:
          service.scope === "GLOBAL"
            ? "Servicos globais so podem ser ajustados pelo super admin."
            : "Este servico permanece privado para a equipe dona.",
      };

  return (
    <div>
      <Link href="/painel/servicos" className="eyebrow text-muted">
        voltar para servicos
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Editar servico
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Ajuste descricao do evento, valor de evento, percentual de prestacao e
        status do item no catalogo.
      </p>

      <div className="mt-8 rounded-[28px] bg-white/70 p-6">
        <ServiceForm
          action={updateServiceCatalogAction.bind(null, service.id)}
          submitLabel="Salvar alteracoes"
          pendingLabel="Salvando..."
          isEdit
          scopeField={scopeField}
          defaults={{
            name: service.name,
            description: service.description,
            eventAmount: service.defaultAmount.toString(),
            defaultPercentage: service.defaultPercentage.toString(),
            isActive: service.isActive,
            scope: service.scope,
          }}
        />
      </div>
    </div>
  );
}
