import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteExecutedServiceButton } from "@/components/delete-executed-service-button";
import { ExecutedServiceForm } from "@/components/executed-service-form";
import { updateExecutedServiceAction } from "@/app/painel/servicos-executados/actions";
import {
  buildClientScopeWhere,
  buildClientServiceScopeWhere,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { serviceCatalogScopeLabels } from "@/lib/service-catalog";
import { buildServiceCatalogScopeWhere } from "@/lib/service-catalog-access";

export const dynamic = "force-dynamic";

type EditExecutedServicePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    returnToClientId?: string;
  }>;
};

export default async function EditExecutedServicePage({
  params,
  searchParams,
}: EditExecutedServicePageProps) {
  const access = await requireOperationalWriteAccess();
  const { id } = await params;
  const { returnToClientId } = await searchParams;

  const [executedService, clients, services] = await Promise.all([
    prisma.clientService.findFirst({
      where: buildClientServiceScopeWhere(access, { id }),
      select: {
        id: true,
        clientId: true,
        serviceCatalogId: true,
        identificationNumber: true,
        description: true,
        eventAmount: true,
        servicePercentage: true,
        amount: true,
      },
    }),
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

  if (!executedService) {
    notFound();
  }

  return (
    <div>
      <Link href="/painel/servicos-executados" className="eyebrow text-muted">
        voltar para servicos executados
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Editar servico executado
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Ajuste o vinculo, a identificacao, o valor do evento e o percentual da
        prestacao registrados.
      </p>

      <div className="mt-8 rounded-[28px] bg-white/70 p-6">
        <ExecutedServiceForm
          action={updateExecutedServiceAction.bind(null, executedService.id)}
          submitLabel="Salvar alteracoes"
          pendingLabel="Salvando..."
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
            clientId: executedService.clientId,
            serviceCatalogId: executedService.serviceCatalogId,
            identificationNumber: executedService.identificationNumber,
            eventAmount: executedService.eventAmount.toString(),
            servicePercentage: executedService.servicePercentage.toString(),
            description: executedService.description,
            returnToClientId,
          }}
        />
      </div>

      <div className="mt-6 max-w-md rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5">
        <p className="text-sm font-semibold text-rose-900">Apagar servico executado</p>
        <p className="mt-2 text-sm leading-6 text-rose-800">
          Use esta opcao apenas quando este registro nao estiver mais correto.
          Se ele ja estiver vinculado a uma assinatura, o sistema vai bloquear a exclusao.
        </p>
        <div className="mt-4">
          <DeleteExecutedServiceButton
            executedServiceId={executedService.id}
            returnToClientId={returnToClientId}
            className="inline-flex items-center rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
