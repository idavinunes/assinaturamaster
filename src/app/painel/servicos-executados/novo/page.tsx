import Link from "next/link";
import { ExecutedServiceForm } from "@/components/executed-service-form";
import { createExecutedServiceAction } from "@/app/painel/servicos-executados/actions";
import {
  buildClientScopeWhere,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { serviceCatalogScopeLabels } from "@/lib/service-catalog";
import { buildServiceCatalogScopeWhere } from "@/lib/service-catalog-access";

export const dynamic = "force-dynamic";

type NewExecutedServicePageProps = {
  searchParams: Promise<{
    clientId?: string;
    returnToClientId?: string;
  }>;
};

export default async function NewExecutedServicePage({
  searchParams,
}: NewExecutedServicePageProps) {
  const access = await requireOperationalWriteAccess();
  const { clientId, returnToClientId } = await searchParams;

  const [clients, services] = await Promise.all([
    prisma.client.findMany({
      where: buildClientScopeWhere(access),
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        clientType: true,
        legalName: true,
        contactName: true,
        documentNumber: true,
        isActive: true,
      },
    }),
    prisma.serviceCatalog.findMany({
      where: buildServiceCatalogScopeWhere(access),
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        scope: true,
        ownerTeam: {
          select: {
            name: true,
          },
        },
        name: true,
        description: true,
        defaultAmount: true,
        defaultPercentage: true,
        isActive: true,
      },
    }),
  ]);

  return (
    <div>
      <Link href="/painel/servicos-executados" className="eyebrow text-muted">
        voltar para servicos executados
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Criar servico executado
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Vincule um cliente a um servico do catalogo e registre descricao de
        evento, valor do evento e percentual da prestacao.
      </p>

      <div className="mt-8 rounded-[28px] bg-white/70 p-6">
        <ExecutedServiceForm
          action={createExecutedServiceAction}
          submitLabel="Criar executado"
          pendingLabel="Criando..."
          clients={clients}
          services={services.map((service) => ({
            ...service,
            defaultAmount: service.defaultAmount.toString(),
            defaultPercentage: service.defaultPercentage.toString(),
            scopeLabel:
              service.scope === "GLOBAL"
                ? serviceCatalogScopeLabels.GLOBAL
                : `${serviceCatalogScopeLabels.TEAM_PRIVATE}${service.ownerTeam ? ` (${service.ownerTeam.name})` : ""}`,
          }))}
          defaults={{
            clientId,
            returnToClientId,
          }}
        />
      </div>
    </div>
  );
}
