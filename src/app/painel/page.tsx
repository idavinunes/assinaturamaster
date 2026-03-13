import clsx from "clsx";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  RefreshCcw,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  buildClientScopeWhere,
  buildClientServiceScopeWhere,
  buildSignatureRequestScopeWhere,
  requireOperationalAccessContext,
} from "@/lib/access-control";
import { getResolvedBrandingSettings } from "@/lib/branding";
import { formatCurrencyBRL } from "@/lib/formatters/br";
import { prisma } from "@/lib/prisma";
import { roleLabels, teamMemberRoleLabels } from "@/lib/roles";
import { buildServiceCatalogScopeWhere } from "@/lib/service-catalog-access";
import { buildTemplateScopeWhere } from "@/lib/template-access";
import {
  DashboardDonutChart,
  DashboardLineChart,
  type DashboardActivityPoint,
  type DashboardStatusBreakdownItem,
} from "@/components/dashboard-visuals";

export const dynamic = "force-dynamic";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildRecentMonthStarts(monthCount: number, referenceDate: Date) {
  return Array.from({ length: monthCount }, (_, index) =>
    new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthCount - 1 - index), 1),
  );
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return date
    .toLocaleDateString("pt-BR", {
      month: "short",
    })
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

function buildMonthlyActivityPoints(params: {
  months: Date[];
  clientRows: Array<{ createdAt: Date }>;
  serviceRows: Array<{ createdAt: Date; amount: { toString(): string } }>;
  requestRows: Array<{ createdAt: Date }>;
}) {
  const buckets = new Map<string, DashboardActivityPoint>(
    params.months.map((month) => [
      getMonthKey(month),
      {
        label: formatMonthLabel(month),
        clients: 0,
        services: 0,
        requests: 0,
        amount: 0,
      },
    ]),
  );

  params.clientRows.forEach((row) => {
    const bucket = buckets.get(getMonthKey(startOfMonth(row.createdAt)));

    if (bucket) {
      bucket.clients += 1;
    }
  });

  params.serviceRows.forEach((row) => {
    const bucket = buckets.get(getMonthKey(startOfMonth(row.createdAt)));

    if (bucket) {
      bucket.services += 1;
      bucket.amount += Number(row.amount.toString());
    }
  });

  params.requestRows.forEach((row) => {
    const bucket = buckets.get(getMonthKey(startOfMonth(row.createdAt)));

    if (bucket) {
      bucket.requests += 1;
    }
  });

  return params.months.map((month) => buckets.get(getMonthKey(month))!);
}

function resolveScopeLabel(params: {
  accessLevel: string;
  activeTeamName: string | null;
  currentUserName: string;
}) {
  if (params.accessLevel === "global") {
    return "Consolidado global";
  }

  if (params.accessLevel === "team") {
    return params.activeTeamName ?? "Equipe ativa";
  }

  return `Carteira de ${params.currentUserName}`;
}

function resolveScopeDescription(params: {
  accessLevel: string;
  activeTeamName: string | null;
  canViewUnassigned: boolean;
}) {
  if (params.accessLevel === "global") {
    return "Voce esta vendo a operacao completa do sistema, sem filtro por equipe.";
  }

  if (params.accessLevel === "team") {
    return `Leitura completa da equipe ${params.activeTeamName ?? "ativa"}, incluindo carteira compartilhada e itens sem responsavel.`;
  }

  return params.canViewUnassigned
    ? "A leitura atual esta focada na sua carteira, com capacidade de acompanhar itens sem responsavel."
    : "A leitura atual mostra apenas clientes, servicos e contratos atribuidos diretamente a voce.";
}

function buildTrend(current: number, previous: number) {
  const delta = current - previous;
  const percentage =
    previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;

  return { delta, percentage };
}

export default async function AdminDashboardPage() {
  const access = await requireOperationalAccessContext();
  const branding = await getResolvedBrandingSettings(access.activeTeamId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAhead = new Date(now);
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
  const recentMonths = buildRecentMonthStarts(6, now);
  const sixMonthsAgo = recentMonths[0];

  const canViewUnassigned = access.capabilities.viewUnassignedPortfolio;

  const [
    usersCount,
    activeClientsCount,
    activeClientsPrevious30Count,
    newClientsLast30Count,
    servicesCount,
    executedServicesCount,
    recentExecutedServicesCount,
    recentExecutedServicesPrevious30Count,
    activeTemplatesCount,
    inProgressRequestsCount,
    draftRequestsCount,
    signedRequestsCount,
    signedLast30Count,
    signedPrevious30Count,
    expiredRequestsCount,
    canceledRequestsCount,
    businessClientsCount,
    personalClientsCount,
    serviceAmountLast30Aggregate,
    serviceAmountPrevious30Aggregate,
    staleDraftsCount,
    expiringSoonCount,
    unassignedClientsCount,
    unassignedServicesCount,
    unassignedRequestsCount,
    recentClientRows,
    recentServiceRows,
    recentRequestRows,
  ] = await Promise.all([
    access.accessLevel === "global"
      ? prisma.user.count()
      : prisma.userTeamMembership.count({
          where: {
            teamId: access.activeTeamId!,
            isActive: true,
          },
        }),
    prisma.client.count({
      where: buildClientScopeWhere(access, {
        isActive: true,
      }),
    }),
    prisma.client.count({
      where: buildClientScopeWhere(access, {
        isActive: true,
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      }),
    }),
    prisma.client.count({
      where: buildClientScopeWhere(access, {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      }),
    }),
    prisma.serviceCatalog.count({
      where: buildServiceCatalogScopeWhere(access, {
        isActive: true,
      }),
    }),
    prisma.clientService.count({
      where: buildClientServiceScopeWhere(access),
    }),
    prisma.clientService.count({
      where: buildClientServiceScopeWhere(access, {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      }),
    }),
    prisma.clientService.count({
      where: buildClientServiceScopeWhere(access, {
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      }),
    }),
    prisma.contractTemplate.count({
      where: buildTemplateScopeWhere(access, { status: "ACTIVE" }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, {
        status: { in: ["SENT", "OPENED"] },
      }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, { status: "DRAFT" }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, { status: "SIGNED" }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, {
        status: "SIGNED",
        signedAt: {
          gte: thirtyDaysAgo,
        },
      }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, {
        status: "SIGNED",
        signedAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, { status: "EXPIRED" }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, { status: "CANCELED" }),
    }),
    prisma.client.count({
      where: buildClientScopeWhere(access, {
        isActive: true,
        clientType: "BUSINESS",
      }),
    }),
    prisma.client.count({
      where: buildClientScopeWhere(access, {
        isActive: true,
        clientType: "PERSONAL",
      }),
    }),
    prisma.clientService.aggregate({
      where: buildClientServiceScopeWhere(access, {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      }),
      _sum: {
        amount: true,
      },
    }),
    prisma.clientService.aggregate({
      where: buildClientServiceScopeWhere(access, {
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      }),
      _sum: {
        amount: true,
      },
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, {
        status: "DRAFT",
        updatedAt: {
          lt: sevenDaysAgo,
        },
      }),
    }),
    prisma.signatureRequest.count({
      where: buildSignatureRequestScopeWhere(access, {
        status: { in: ["SENT", "OPENED"] },
        expiresAt: {
          gte: now,
          lte: sevenDaysAhead,
        },
      }),
    }),
    canViewUnassigned
      ? prisma.client.count({
          where: buildClientScopeWhere(access, {
            responsibleUserId: null,
          }),
        })
      : Promise.resolve(0),
    canViewUnassigned
      ? prisma.clientService.count({
          where: buildClientServiceScopeWhere(access, {
            responsibleUserId: null,
          }),
        })
      : Promise.resolve(0),
    canViewUnassigned
      ? prisma.signatureRequest.count({
          where: buildSignatureRequestScopeWhere(access, {
            responsibleUserId: null,
          }),
        })
      : Promise.resolve(0),
    prisma.client.findMany({
      where: buildClientScopeWhere(access, {
        createdAt: {
          gte: sixMonthsAgo,
        },
      }),
      select: {
        createdAt: true,
      },
    }),
    prisma.clientService.findMany({
      where: buildClientServiceScopeWhere(access, {
        createdAt: {
          gte: sixMonthsAgo,
        },
      }),
      select: {
        createdAt: true,
        amount: true,
      },
    }),
    prisma.signatureRequest.findMany({
      where: buildSignatureRequestScopeWhere(access, {
        createdAt: {
          gte: sixMonthsAgo,
        },
      }),
      select: {
        createdAt: true,
      },
    }),
  ]);

  const serviceAmountLast30 = Number(
    serviceAmountLast30Aggregate._sum.amount?.toString() ?? "0",
  );
  const serviceAmountPrevious30 = Number(
    serviceAmountPrevious30Aggregate._sum.amount?.toString() ?? "0",
  );
  const attentionQueueCount =
    staleDraftsCount +
    expiringSoonCount +
    expiredRequestsCount +
    canceledRequestsCount +
    (canViewUnassigned
      ? unassignedClientsCount + unassignedServicesCount + unassignedRequestsCount
      : 0);
  const unassignedTotal =
    unassignedClientsCount + unassignedServicesCount + unassignedRequestsCount;
  const totalRequestsCount =
    draftRequestsCount +
    inProgressRequestsCount +
    signedRequestsCount +
    expiredRequestsCount +
    canceledRequestsCount;
  const completionRate =
    totalRequestsCount > 0 ? (signedRequestsCount / totalRequestsCount) * 100 : 0;
  const monthlyActivity = buildMonthlyActivityPoints({
    months: recentMonths,
    clientRows: recentClientRows,
    serviceRows: recentServiceRows,
    requestRows: recentRequestRows,
  });
  const sixMonthAmountTotal = monthlyActivity.reduce(
    (sum, point) => sum + point.amount,
    0,
  );

  const statusBreakdown: DashboardStatusBreakdownItem[] = [
    { label: "Rascunhos", value: draftRequestsCount, tone: "neutral" },
    { label: "Em andamento", value: inProgressRequestsCount, tone: "accent" },
    { label: "Assinadas", value: signedRequestsCount, tone: "positive" },
    {
      label: "Expiradas",
      value: expiredRequestsCount + canceledRequestsCount,
      tone: "danger",
    },
  ];

  const scopeLabel = resolveScopeLabel({
    accessLevel: access.accessLevel,
    activeTeamName: access.activeTeam?.teamName ?? null,
    currentUserName: access.name,
  });
  const scopeDescription = resolveScopeDescription({
    accessLevel: access.accessLevel,
    activeTeamName: access.activeTeam?.teamName ?? null,
    canViewUnassigned,
  });
  const scopeRoleLabel =
    access.accessLevel === "global"
      ? roleLabels[access.globalRole]
      : access.activeTeam
        ? teamMemberRoleLabels[access.activeTeam.role]
        : roleLabels[access.globalRole];

  const attentionPanels = [
    {
      label: "Rascunhos parados",
      value: staleDraftsCount,
      helper: "Solicitacoes em rascunho sem evolucao ha mais de 7 dias.",
      href: "/painel/assinaturas",
    },
    {
      label: "Expiram em 7 dias",
      value: expiringSoonCount,
      helper: "Links ja enviados que pedem acompanhamento imediato.",
      href: "/painel/assinaturas",
    },
    {
      label: "Encerradas com atrito",
      value: expiredRequestsCount + canceledRequestsCount,
      helper: "Expiradas ou canceladas que podem exigir reabordagem.",
      href: "/painel/assinaturas",
    },
    ...(canViewUnassigned
      ? [
          {
            label: "Sem responsavel",
            value: unassignedTotal,
            helper: "Clientes, servicos e assinaturas aguardando redistribuicao.",
            href: "/painel/clientes?scope=unassigned",
          },
        ]
      : []),
  ];

  const urgentActions = attentionPanels
    .filter((panel) => panel.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 3);

  const kpis = [
    {
      title: "Assinaturas concluidas",
      value: signedRequestsCount.toLocaleString("pt-BR"),
      trend: buildTrend(signedLast30Count, signedPrevious30Count),
      icon: CheckCircle2,
      helper: `${signedLast30Count.toLocaleString("pt-BR")} nos ultimos 30 dias`,
    },
    {
      title: "Servicos executados",
      value: executedServicesCount.toLocaleString("pt-BR"),
      trend: buildTrend(recentExecutedServicesCount, recentExecutedServicesPrevious30Count),
      icon: ClipboardList,
      helper: `${recentExecutedServicesCount.toLocaleString("pt-BR")} novos nos ultimos 30 dias`,
    },
    {
      title: "Novos clientes",
      value: newClientsLast30Count.toLocaleString("pt-BR"),
      trend: buildTrend(newClientsLast30Count, activeClientsPrevious30Count),
      icon: Users,
      helper: `${businessClientsCount.toLocaleString("pt-BR")} PJ • ${personalClientsCount.toLocaleString("pt-BR")} PF ativos`,
    },
    {
      title: "Prestacao em 30 dias",
      value: formatCurrencyBRL(serviceAmountLast30),
      trend: buildTrend(serviceAmountLast30, serviceAmountPrevious30),
      icon: DollarSign,
      helper: `${formatCurrencyBRL(sixMonthAmountTotal)} acumulados em 6 meses`,
    },
  ];

  return (
    <div>
      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow text-muted">{scopeLabel}</span>
            <span className="inline-flex rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-foreground">
              {scopeRoleLabel}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Visao geral
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Bem-vindo ao centro de operacoes do {branding.productShortName}.{" "}
            {scopeDescription}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full border border-line bg-white px-3 py-1">
              {usersCount.toLocaleString("pt-BR")} usuarios
            </span>
            <span className="rounded-full border border-line bg-white px-3 py-1">
              {servicesCount.toLocaleString("pt-BR")} servicos no catalogo
            </span>
            <span className="rounded-full border border-line bg-white px-3 py-1">
              {activeTemplatesCount.toLocaleString("pt-BR")} modelos ativos
            </span>
            <span className="rounded-full border border-line bg-white px-3 py-1">
              {activeClientsCount.toLocaleString("pt-BR")} clientes ativos
            </span>
          </div>
        </div>

        <Link
          href="/painel"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-stone-50"
        >
          <RefreshCcw className="size-4" />
          Sincronizar dados
        </Link>
      </header>

      <section className="mt-8 rounded-[28px] border-l-4 border-l-accent bg-white/78 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-muted">Acoes criticas</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Itens que exigem atencao imediata
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              A fila critica consolidada soma {attentionQueueCount.toLocaleString("pt-BR")} itens no recorte atual.
            </p>
          </div>

          <Link
            href="/painel/assinaturas"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-stone-50"
          >
            Ver assinaturas
          </Link>
        </div>

        <div className="mt-5 grid gap-3">
          {urgentActions.length > 0 ? (
            urgentActions.map((panel) => (
              <div
                key={panel.label}
                className="flex flex-col gap-4 rounded-[22px] bg-stone-50/80 p-4 transition hover:bg-white md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-white text-accent shadow-sm">
                    <AlertCircle className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{panel.label}</p>
                    <p className="mt-1 text-sm text-muted">{panel.helper}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                    {panel.value.toLocaleString("pt-BR")}
                  </span>
                  <Link
                    href={panel.href}
                    className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-stone-100"
                  >
                    Tratar agora
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] bg-stone-50/80 px-4 py-5 text-sm text-muted">
              Nenhum item critico no momento.
            </div>
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const trendIsPositive = kpi.trend.delta >= 0;
          const trendValue = Math.round(Math.abs(kpi.trend.percentage));

          return (
            <div key={kpi.title} className="rounded-[28px] bg-white/78 p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-accent">
                  <kpi.icon className="size-5" />
                </span>
                <span
                  className={clsx(
                    "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                    trendIsPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                  )}
                >
                  {trendIsPositive ? (
                    <ArrowUp className="mr-1 size-3.5" />
                  ) : (
                    <ArrowDown className="mr-1 size-3.5" />
                  )}
                  {trendValue}%
                </span>
              </div>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {kpi.title}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {kpi.value}
              </p>
              <p className="mt-2 text-sm text-muted">{kpi.helper}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section className="rounded-[30px] bg-white/78 p-6">
          <div>
            <p className="eyebrow text-muted">Distribuicao de status</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Volume atual por etapa
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              O pipeline atual tem {Math.round(completionRate)}% das solicitacoes em estado concluido.
            </p>
          </div>

          <div className="mt-6">
            <DashboardDonutChart items={statusBreakdown} />
          </div>
        </section>

        <section className="rounded-[30px] bg-white/78 p-6">
          <div>
            <p className="eyebrow text-muted">Crescimento mensal</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Evolucao do volume de assinaturas
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Leitura dos ultimos 6 meses com base em solicitacoes criadas no periodo.
            </p>
          </div>

          <div className="mt-6">
            <DashboardLineChart points={monthlyActivity} valueKey="requests" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full border border-line bg-white px-3 py-1">
              {inProgressRequestsCount.toLocaleString("pt-BR")} em andamento
            </span>
            <span className="rounded-full border border-line bg-white px-3 py-1">
              {formatCurrencyBRL(sixMonthAmountTotal)} em prestacao acumulada
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
