import { Role, TemplateScope, TeamMemberRole } from "@prisma/client";

export type TemplateAccessContextLike = {
  globalRole: Role;
  activeTeamId: string | null;
  teamRole: TeamMemberRole | null;
};

export type TemplateAccessRule =
  | {
      kind: "all";
    }
  | {
      kind: "global-only";
    }
  | {
      kind: "global-and-team";
      teamId: string;
    };

export function resolveTemplateAccessRule(
  context: TemplateAccessContextLike,
): TemplateAccessRule {
  if (context.globalRole === Role.SUPER_ADMIN) {
    return { kind: "all" };
  }

  if (context.activeTeamId) {
    return {
      kind: "global-and-team",
      teamId: context.activeTeamId,
    };
  }

  return { kind: "global-only" };
}

export function canManageTemplatesInContext(context: TemplateAccessContextLike) {
  return (
    context.globalRole === Role.SUPER_ADMIN ||
    context.teamRole === TeamMemberRole.ADMIN ||
    context.teamRole === TeamMemberRole.MANAGER ||
    context.teamRole === TeamMemberRole.OPERATOR
  );
}

export function canCreateGlobalTemplatesInContext(context: TemplateAccessContextLike) {
  return context.globalRole === Role.SUPER_ADMIN;
}

export function canEditTemplateInContext(
  context: TemplateAccessContextLike,
  template: {
    scope: TemplateScope;
    ownerTeamId: string | null;
  },
) {
  if (!canManageTemplatesInContext(context)) {
    return false;
  }

  if (context.globalRole === Role.SUPER_ADMIN) {
    return true;
  }

  return (
    template.scope === TemplateScope.TEAM_PRIVATE &&
    Boolean(context.activeTeamId) &&
    template.ownerTeamId === context.activeTeamId
  );
}

export function canDeleteTemplateInContext(context: TemplateAccessContextLike) {
  return context.globalRole === Role.SUPER_ADMIN;
}
