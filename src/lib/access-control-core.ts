import { Role, TeamMemberRole } from "@prisma/client";

export const accessLevelValues = ["global", "team", "assigned"] as const;

export type AccessLevel = (typeof accessLevelValues)[number];

export type SessionTeamMembershipLike = {
  teamId: string;
  teamName: string;
  teamSlug: string;
  role: TeamMemberRole;
};

export type SessionUserLike = {
  id: string;
  role: Role;
  activeTeamId: string | null;
  activeTeam: SessionTeamMembershipLike | null;
};

export type OperationalScope = {
  accessLevel: AccessLevel;
  teamId: string | null;
  responsibleUserId: string | null;
  canViewUnassigned: boolean;
};

export type AccessCapabilities = {
  readOperationalData: boolean;
  manageOperationalData: boolean;
  viewTeamPortfolio: boolean;
  viewUnassignedPortfolio: boolean;
  transferPortfolio: boolean;
  manageGlobalAdministration: boolean;
  manageTeamMembers: boolean;
  manageTeamBranding: boolean;
  deleteSignedRequests: boolean;
};

export type AccessContextLike<TSession extends SessionUserLike = SessionUserLike> = TSession & {
  globalRole: Role;
  teamRole: TeamMemberRole | null;
  accessLevel: AccessLevel;
  scope: OperationalScope;
  capabilities: AccessCapabilities;
};

export function resolveAccessLevel(session: SessionUserLike): AccessLevel {
  if (session.role === Role.SUPER_ADMIN) {
    return "global";
  }

  if (
    session.activeTeam?.role === TeamMemberRole.ADMIN ||
    session.activeTeam?.role === TeamMemberRole.MANAGER
  ) {
    return "team";
  }

  return "assigned";
}

export function buildOperationalScope(
  session: SessionUserLike,
  accessLevel: AccessLevel,
): OperationalScope {
  return {
    accessLevel,
    teamId: session.activeTeam?.teamId ?? null,
    responsibleUserId: accessLevel === "assigned" ? session.id : null,
    canViewUnassigned: accessLevel !== "assigned",
  };
}

export function buildAccessContext<TSession extends SessionUserLike>(
  session: TSession,
): AccessContextLike<TSession> {
  const accessLevel = resolveAccessLevel(session);
  const teamRole = session.activeTeam?.role ?? null;
  const manageGlobalAdministration =
    session.role === Role.SUPER_ADMIN || session.role === Role.ADMIN;
  const manageOperationalData =
    session.role === Role.SUPER_ADMIN ||
    teamRole === TeamMemberRole.ADMIN ||
    teamRole === TeamMemberRole.MANAGER ||
    teamRole === TeamMemberRole.OPERATOR;

  return {
    ...session,
    globalRole: session.role,
    teamRole,
    accessLevel,
    scope: buildOperationalScope(session, accessLevel),
    capabilities: {
      readOperationalData: session.role === Role.SUPER_ADMIN || Boolean(session.activeTeam),
      manageOperationalData,
      viewTeamPortfolio: accessLevel !== "assigned",
      viewUnassignedPortfolio: accessLevel !== "assigned",
      transferPortfolio: accessLevel !== "assigned",
      manageGlobalAdministration,
      manageTeamMembers:
        session.role === Role.SUPER_ADMIN || teamRole === TeamMemberRole.ADMIN,
      manageTeamBranding:
        session.role === Role.SUPER_ADMIN || teamRole === TeamMemberRole.ADMIN,
      deleteSignedRequests: session.role === Role.SUPER_ADMIN,
    },
  };
}
