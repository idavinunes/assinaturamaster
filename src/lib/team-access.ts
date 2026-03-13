import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  canManageGlobalAdministration,
  canManageTeamMembers,
  type AccessContext,
  requireAccessContext,
} from "@/lib/access-control";

export async function requireTeamManagementAccess() {
  const actor = await requireAccessContext();

  if (!canManageGlobalAdministration(actor) && !canManageTeamMembers(actor)) {
    redirect("/painel");
  }

  return actor;
}

export function canManageTeam(actor: AccessContext, teamId: string) {
  if (canManageGlobalAdministration(actor)) {
    return true;
  }

  return canManageTeamMembers(actor) && actor.activeTeamId === teamId;
}

export function canEditTeamMetadata(actor: AccessContext) {
  return canManageGlobalAdministration(actor);
}

export function buildManagedTeamsWhere(
  actor: AccessContext,
  extraWhere?: Prisma.TeamWhereInput,
): Prisma.TeamWhereInput | undefined {
  if (canManageGlobalAdministration(actor)) {
    return extraWhere;
  }

  if (!actor.activeTeamId) {
    return {
      id: "__no_team_scope__",
    };
  }

  if (!extraWhere || Object.keys(extraWhere).length === 0) {
    return {
      id: actor.activeTeamId,
    };
  }

  return {
    AND: [{ id: actor.activeTeamId }, extraWhere],
  } satisfies Prisma.TeamWhereInput;
}
