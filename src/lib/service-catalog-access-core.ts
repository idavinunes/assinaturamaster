import { Role, ServiceCatalogScope, TeamMemberRole } from "@prisma/client";

export type ServiceCatalogAccessContextLike = {
  globalRole: Role;
  activeTeamId: string | null;
  teamRole: TeamMemberRole | null;
};

export type ServiceCatalogAccessRule =
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

export function resolveServiceCatalogAccessRule(
  context: ServiceCatalogAccessContextLike,
): ServiceCatalogAccessRule {
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

export function canManageServiceCatalogInContext(
  context: ServiceCatalogAccessContextLike,
) {
  return (
    context.globalRole === Role.SUPER_ADMIN ||
    context.teamRole === TeamMemberRole.ADMIN ||
    context.teamRole === TeamMemberRole.MANAGER ||
    context.teamRole === TeamMemberRole.OPERATOR
  );
}

export function canCreateGlobalServiceCatalogInContext(
  context: ServiceCatalogAccessContextLike,
) {
  return context.globalRole === Role.SUPER_ADMIN;
}

export function canEditServiceCatalogInContext(
  context: ServiceCatalogAccessContextLike,
  service: {
    scope: ServiceCatalogScope;
    ownerTeamId: string | null;
  },
) {
  if (!canManageServiceCatalogInContext(context)) {
    return false;
  }

  if (context.globalRole === Role.SUPER_ADMIN) {
    return true;
  }

  return (
    service.scope === ServiceCatalogScope.TEAM_PRIVATE &&
    Boolean(context.activeTeamId) &&
    service.ownerTeamId === context.activeTeamId
  );
}
