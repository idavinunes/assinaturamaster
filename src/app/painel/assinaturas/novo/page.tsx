import Link from "next/link";
import { SignatureRequestForm } from "@/components/signature-request-form";
import { createSignatureRequestAction } from "@/app/painel/assinaturas/actions";
import {
  buildClientScopeWhere,
  buildClientServiceScopeWhere,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { buildTemplateScopeWhere } from "@/lib/template-access";

export const dynamic = "force-dynamic";

export default async function NewSignatureRequestPage() {
  const access = await requireOperationalWriteAccess();

  const [clients, executedServices, templates] = await Promise.all([
    prisma.client.findMany({
      where: buildClientScopeWhere(access),
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        clientType: true,
        legalName: true,
        contactName: true,
        documentNumber: true,
        email: true,
        phone: true,
        isActive: true,
      },
    }),
    prisma.clientService.findMany({
      where: buildClientServiceScopeWhere(access, {
        signatureRequests: {
          none: {},
        },
      }),
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        clientId: true,
        identificationNumber: true,
        eventAmount: true,
        servicePercentage: true,
        amount: true,
        serviceCatalog: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.contractTemplate.findMany({
      where: buildTemplateScopeWhere(access, {
        status: {
          in: ["ACTIVE", "DRAFT"],
        },
      }),
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        version: true,
        status: true,
        scope: true,
        ownerTeam: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    <div>
      <Link href="/painel/assinaturas" className="eyebrow text-muted">
        voltar para assinaturas
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Criar assinatura
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Gere o link publico escolhendo cliente, servico executado, modelo e os
        dados do assinante. Cada servico executado pode alimentar apenas uma
        solicitacao de assinatura.
      </p>

      <div className="mt-8 rounded-[28px] bg-white/70 p-6">
        <SignatureRequestForm
          action={createSignatureRequestAction}
          submitLabel="Gerar link"
          pendingLabel="Gerando..."
          clients={clients}
          executedServices={executedServices.map((service) => ({
            ...service,
            eventAmount: service.eventAmount.toString(),
            servicePercentage: service.servicePercentage.toString(),
            amount: service.amount.toString(),
          }))}
          templates={templates}
          defaults={{
            status: "DRAFT",
          }}
        />
      </div>
    </div>
  );
}
