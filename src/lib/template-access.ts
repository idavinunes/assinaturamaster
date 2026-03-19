import { Prisma, Role, TemplateScope } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  requireAccessContext,
  type AccessContext,
} from "@/lib/access-control";
import {
  canCreateGlobalTemplatesInContext,
  canDeleteTemplateInContext,
  canEditTemplateInContext,
  canManageTemplatesInContext,
  resolveTemplateAccessRule,
} from "@/lib/template-access-core";

function mergeTemplateScopeWhere(
  scopeWhere: Prisma.ContractTemplateWhereInput | undefined,
  extraWhere?: Prisma.ContractTemplateWhereInput,
) {
  if (!scopeWhere) {
    return extraWhere;
  }

  if (!extraWhere || Object.keys(extraWhere).length === 0) {
    return scopeWhere;
  }

  return {
    AND: [scopeWhere, extraWhere],
  } satisfies Prisma.ContractTemplateWhereInput;
}

export function canReadTemplates(context: AccessContext) {
  return context.globalRole !== Role.VIEWER || Boolean(context.activeTeamId);
}

export function canManageTemplates(context: AccessContext) {
  return canManageTemplatesInContext(context);
}

export function canCreateGlobalTemplates(context: AccessContext) {
  return canCreateGlobalTemplatesInContext(context);
}

export function buildTemplateScopeWhere(
  context: AccessContext,
  extraWhere?: Prisma.ContractTemplateWhereInput,
): Prisma.ContractTemplateWhereInput | undefined {
  const accessRule = resolveTemplateAccessRule(context);
  let baseWhere: Prisma.ContractTemplateWhereInput | undefined;

  if (accessRule.kind === "all") {
    baseWhere = undefined;
  } else if (accessRule.kind === "global-and-team") {
    baseWhere = {
      OR: [
        { scope: TemplateScope.GLOBAL },
        {
          scope: TemplateScope.TEAM_PRIVATE,
          teamAccesses: {
            some: {
              teamId: accessRule.teamId,
            },
          },
        },
      ],
    };
  } else {
    baseWhere = {
      scope: TemplateScope.GLOBAL,
    };
  }

  return mergeTemplateScopeWhere(baseWhere, extraWhere);
}

export function canEditTemplate(
  context: AccessContext,
  template: {
    scope: TemplateScope;
    ownerTeamId: string | null;
  },
) {
  return canEditTemplateInContext(context, template);
}

export function canDeleteTemplate(
  context: AccessContext,
  template: {
    scope: TemplateScope;
    ownerTeamId: string | null;
  },
) {
  void template;
  return canDeleteTemplateInContext(context);
}

export async function requireTemplateAccessContext() {
  const context = await requireAccessContext();

  if (!canReadTemplates(context)) {
    redirect("/painel");
  }

  return context;
}

export async function requireTemplateManageContext() {
  const context = await requireTemplateAccessContext();

  if (!canManageTemplates(context)) {
    redirect("/painel/modelos");
  }

  return context;
}
