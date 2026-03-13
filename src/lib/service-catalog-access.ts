import { Prisma, Role, ServiceCatalogScope } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  requireAccessContext,
  type AccessContext,
} from "@/lib/access-control";
import {
  canCreateGlobalServiceCatalogInContext,
  canEditServiceCatalogInContext,
  canManageServiceCatalogInContext,
  resolveServiceCatalogAccessRule,
} from "@/lib/service-catalog-access-core";

function mergeServiceCatalogScopeWhere(
  scopeWhere: Prisma.ServiceCatalogWhereInput | undefined,
  extraWhere?: Prisma.ServiceCatalogWhereInput,
) {
  if (!scopeWhere) {
    return extraWhere;
  }

  if (!extraWhere || Object.keys(extraWhere).length === 0) {
    return scopeWhere;
  }

  return {
    AND: [scopeWhere, extraWhere],
  } satisfies Prisma.ServiceCatalogWhereInput;
}

export function canReadServiceCatalog(context: AccessContext) {
  return context.globalRole !== Role.VIEWER || Boolean(context.activeTeamId);
}

export function canManageServiceCatalog(context: AccessContext) {
  return canManageServiceCatalogInContext(context);
}

export function canCreateGlobalServiceCatalog(context: AccessContext) {
  return canCreateGlobalServiceCatalogInContext(context);
}

export function buildServiceCatalogScopeWhere(
  context: AccessContext,
  extraWhere?: Prisma.ServiceCatalogWhereInput,
): Prisma.ServiceCatalogWhereInput | undefined {
  const accessRule = resolveServiceCatalogAccessRule(context);
  let baseWhere: Prisma.ServiceCatalogWhereInput | undefined;

  if (accessRule.kind === "all") {
    baseWhere = undefined;
  } else if (accessRule.kind === "global-and-team") {
    baseWhere = {
      OR: [
        { scope: ServiceCatalogScope.GLOBAL },
        {
          scope: ServiceCatalogScope.TEAM_PRIVATE,
          ownerTeamId: accessRule.teamId,
        },
      ],
    };
  } else {
    baseWhere = {
      scope: ServiceCatalogScope.GLOBAL,
    };
  }

  return mergeServiceCatalogScopeWhere(baseWhere, extraWhere);
}

export function canEditServiceCatalog(
  context: AccessContext,
  service: {
    scope: ServiceCatalogScope;
    ownerTeamId: string | null;
  },
) {
  return canEditServiceCatalogInContext(context, service);
}

export async function requireServiceCatalogAccessContext() {
  const context = await requireAccessContext();

  if (!canReadServiceCatalog(context)) {
    redirect("/painel");
  }

  return context;
}

export async function requireServiceCatalogManageContext() {
  const context = await requireServiceCatalogAccessContext();

  if (!canManageServiceCatalog(context)) {
    redirect("/painel/servicos");
  }

  return context;
}
