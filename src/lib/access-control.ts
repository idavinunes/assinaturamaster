import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  getCurrentSession,
  requireSession,
  type SessionUser,
} from "@/lib/auth";
import {
  buildAccessContext,
  type AccessContextLike,
  type AccessCapabilities,
  type AccessLevel,
  accessLevelValues,
  type OperationalScope,
} from "@/lib/access-control-core";

export { accessLevelValues };
export type { AccessCapabilities, AccessLevel, OperationalScope };
export type AccessContext = AccessContextLike<SessionUser>;

export async function getAccessContext(): Promise<AccessContext | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return buildAccessContext(session);
}

export async function requireAccessContext() {
  const session = await requireSession();
  return buildAccessContext(session);
}

export async function requireOperationalAccessContext() {
  const context = await requireAccessContext();

  if (!context.capabilities.readOperationalData || !context.activeTeam) {
    redirect("/painel");
  }

  return context;
}

export async function requireOperationalWriteAccess() {
  const context = await requireOperationalAccessContext();

  if (!context.capabilities.manageOperationalData) {
    redirect("/painel");
  }

  return context;
}

export function isGlobalAccessContext(context: AccessContext) {
  return context.accessLevel === "global";
}

export function hasTeamWideOperationalAccess(context: AccessContext) {
  return context.accessLevel === "global" || context.accessLevel === "team";
}

export function hasAssignedOperationalAccess(context: AccessContext) {
  return context.accessLevel === "assigned";
}

export function canManageOperationalRecords(context: AccessContext) {
  return context.capabilities.manageOperationalData;
}

export function canViewUnassignedOperationalRecords(context: AccessContext) {
  return context.capabilities.viewUnassignedPortfolio;
}

export function canTransferOperationalOwnership(context: AccessContext) {
  return context.capabilities.transferPortfolio;
}

export function canManageGlobalAdministration(context: AccessContext) {
  return context.capabilities.manageGlobalAdministration;
}

export function canManageTeamMembers(context: AccessContext) {
  return context.capabilities.manageTeamMembers;
}

export function canManageTeamBranding(context: AccessContext) {
  return context.capabilities.manageTeamBranding;
}

export function canDeleteSignedSignatureRequests(context: AccessContext) {
  return context.capabilities.deleteSignedRequests;
}

export function canDownloadClientDocuments(context: AccessContext) {
  return hasTeamWideOperationalAccess(context);
}

export function canDeleteClientDocuments(context: AccessContext) {
  return hasTeamWideOperationalAccess(context);
}

function mergeClientScopeWhere(
  scopeWhere: Prisma.ClientWhereInput | undefined,
  extraWhere?: Prisma.ClientWhereInput,
) {
  if (!scopeWhere) {
    return extraWhere;
  }

  if (!extraWhere || Object.keys(extraWhere).length === 0) {
    return scopeWhere;
  }

  return {
    AND: [scopeWhere, extraWhere],
  } satisfies Prisma.ClientWhereInput;
}

function mergeClientServiceScopeWhere(
  scopeWhere: Prisma.ClientServiceWhereInput | undefined,
  extraWhere?: Prisma.ClientServiceWhereInput,
) {
  if (!scopeWhere) {
    return extraWhere;
  }

  if (!extraWhere || Object.keys(extraWhere).length === 0) {
    return scopeWhere;
  }

  return {
    AND: [scopeWhere, extraWhere],
  } satisfies Prisma.ClientServiceWhereInput;
}

function mergeSignatureRequestScopeWhere(
  scopeWhere: Prisma.SignatureRequestWhereInput | undefined,
  extraWhere?: Prisma.SignatureRequestWhereInput,
) {
  if (!scopeWhere) {
    return extraWhere;
  }

  if (!extraWhere || Object.keys(extraWhere).length === 0) {
    return scopeWhere;
  }

  return {
    AND: [scopeWhere, extraWhere],
  } satisfies Prisma.SignatureRequestWhereInput;
}

export function buildClientScopeWhere(
  context: AccessContext,
  extraWhere?: Prisma.ClientWhereInput,
): Prisma.ClientWhereInput | undefined {
  if (context.accessLevel === "global") {
    return extraWhere;
  }

  if (!context.activeTeamId) {
    return {
      id: "__no_client_scope__",
    };
  }

  if (context.accessLevel === "team") {
    return mergeClientScopeWhere(
      {
        teamId: context.activeTeamId,
      },
      extraWhere,
    );
  }

  return mergeClientScopeWhere(
    {
      teamId: context.activeTeamId,
      responsibleUserId: context.id,
    },
    extraWhere,
  );
}

export function buildClientServiceScopeWhere(
  context: AccessContext,
  extraWhere?: Prisma.ClientServiceWhereInput,
): Prisma.ClientServiceWhereInput | undefined {
  if (context.accessLevel === "global") {
    return extraWhere;
  }

  if (!context.activeTeamId) {
    return {
      id: "__no_client_service_scope__",
    };
  }

  if (context.accessLevel === "team") {
    return mergeClientServiceScopeWhere(
      {
        teamId: context.activeTeamId,
      },
      extraWhere,
    );
  }

  return mergeClientServiceScopeWhere(
    {
      teamId: context.activeTeamId,
      responsibleUserId: context.id,
    },
    extraWhere,
  );
}

export function buildSignatureRequestScopeWhere(
  context: AccessContext,
  extraWhere?: Prisma.SignatureRequestWhereInput,
): Prisma.SignatureRequestWhereInput | undefined {
  if (context.accessLevel === "global") {
    return extraWhere;
  }

  if (!context.activeTeamId) {
    return {
      id: "__no_signature_request_scope__",
    };
  }

  if (context.accessLevel === "team") {
    return mergeSignatureRequestScopeWhere(
      {
        teamId: context.activeTeamId,
      },
      extraWhere,
    );
  }

  return mergeSignatureRequestScopeWhere(
    {
      teamId: context.activeTeamId,
      responsibleUserId: context.id,
    },
    extraWhere,
  );
}
