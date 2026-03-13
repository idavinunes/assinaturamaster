"use server";

import { Prisma, TeamMemberRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageGlobalAdministration } from "@/lib/access-control";
import { registerUserAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  canEditTeamMetadata,
  canManageTeam,
  requireTeamManagementAccess,
} from "@/lib/team-access";
import { normalizeTeamSlug } from "@/lib/teams";
import {
  createTeamSchema,
  updateTeamMembershipSchema,
  updateTeamSchema,
  upsertTeamMembershipSchema,
} from "@/lib/validation/forms";

export type TeamFormState = {
  error?: string;
  success?: string;
};

export type TeamMembershipFormState = {
  error?: string;
  success?: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildTeamPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    slug: normalizeTeamSlug(String(formData.get("slug") ?? "")),
    description: optionalValue(formData.get("description")),
  };
}

function getTeamErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ja existe uma equipe com esse identificador.";
  }

  return "Nao foi possivel salvar a equipe.";
}

function revalidateTeamRoutes(teamId?: string) {
  revalidatePath("/painel", "layout");
  revalidatePath("/painel");
  revalidatePath("/painel/equipes");
  revalidatePath("/painel/usuarios");

  if (teamId) {
    revalidatePath(`/painel/equipes/${teamId}/editar`);
  }
}

async function getTeamForMembershipUpdate(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });
}

export async function createTeamAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const actor = await requireTeamManagementAccess();

  if (!canManageGlobalAdministration(actor)) {
    return { error: "Apenas administradores globais podem criar equipes." };
  }

  const parsed = createTeamSchema.safeParse(buildTeamPayload(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  let team: { id: string; name: string };

  try {
    team = await prisma.team.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || undefined,
        memberships: {
          create: {
            userId: actor.id,
            role: TeamMemberRole.ADMIN,
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
  } catch (error) {
    return { error: getTeamErrorMessage(error) };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_CREATED",
    description: `Equipe ${team.name} criada por ${actor.email}.`,
    teamId: team.id,
  }).catch(() => undefined);

  revalidateTeamRoutes(team.id);
  redirect(`/painel/equipes/${team.id}/editar`);
}

export async function updateTeamAction(
  teamId: string,
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const actor = await requireTeamManagementAccess();

  if (!canEditTeamMetadata(actor)) {
    return { error: "Apenas administradores globais podem alterar os dados da equipe." };
  }

  const parsed = updateTeamSchema.safeParse({
    ...buildTeamPayload(formData),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const existingTeam = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!existingTeam) {
    return { error: "Equipe nao encontrada." };
  }

  try {
    await prisma.team.update({
      where: { id: teamId },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || undefined,
        isActive: parsed.data.isActive,
      },
    });
  } catch (error) {
    return { error: getTeamErrorMessage(error) };
  }

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_UPDATED",
    description: `Equipe ${parsed.data.name} atualizada por ${actor.email}.`,
    teamId,
    payload: JSON.stringify({
      previousIsActive: existingTeam.isActive,
      nextIsActive: parsed.data.isActive,
    }),
  }).catch(() => undefined);

  revalidateTeamRoutes(teamId);

  return { success: "Equipe atualizada." };
}

export async function createTeamMembershipAction(
  teamId: string,
  _previousState: TeamMembershipFormState,
  formData: FormData,
): Promise<TeamMembershipFormState> {
  const actor = await requireTeamManagementAccess();

  if (!canManageTeam(actor, teamId)) {
    return { error: "Voce nao possui permissao para gerir membros desta equipe." };
  }

  const parsed = upsertTeamMembershipSchema.safeParse({
    userId: String(formData.get("userId") ?? "").trim(),
    role: String(formData.get("role") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const [team, user] = await Promise.all([
    getTeamForMembershipUpdate(teamId),
    prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    }),
  ]);

  if (!team) {
    return { error: "Equipe nao encontrada." };
  }

  if (!user || !user.isActive) {
    return { error: "Selecione um usuario ativo para a equipe." };
  }

  await prisma.userTeamMembership.upsert({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId,
      },
    },
    update: {
      role: parsed.data.role,
      isActive: true,
    },
    create: {
      userId: user.id,
      teamId,
      role: parsed.data.role,
      isActive: true,
    },
  });

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_MEMBER_UPSERTED",
    description: `Usuario ${user.email} vinculado a equipe ${team.name} como ${parsed.data.role} por ${actor.email}.`,
    teamId,
    payload: JSON.stringify({
      userId: user.id,
      role: parsed.data.role,
    }),
  }).catch(() => undefined);

  revalidateTeamRoutes(teamId);

  return { success: `${user.name} agora participa da equipe ${team.name}.` };
}

export async function updateTeamMembershipAction(
  teamId: string,
  membershipId: string,
  _previousState: TeamMembershipFormState,
  formData: FormData,
): Promise<TeamMembershipFormState> {
  const actor = await requireTeamManagementAccess();

  if (!canManageTeam(actor, teamId)) {
    return { error: "Voce nao possui permissao para gerir membros desta equipe." };
  }

  const parsed = updateTeamMembershipSchema.safeParse({
    role: String(formData.get("role") ?? "").trim(),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const membership = await prisma.userTeamMembership.findFirst({
    where: {
      id: membershipId,
      teamId,
    },
    select: {
      id: true,
      userId: true,
      role: true,
      isActive: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!membership) {
    return { error: "Vinculo da equipe nao encontrado." };
  }

  if (
    membership.userId === actor.id &&
    actor.activeTeamId === teamId &&
    !canManageGlobalAdministration(actor) &&
    (membership.role !== parsed.data.role || membership.isActive !== parsed.data.isActive)
  ) {
    return { error: "Nao altere o proprio vinculo da equipe ativa por esta tela." };
  }

  await prisma.userTeamMembership.update({
    where: { id: membership.id },
    data: {
      role: parsed.data.role,
      isActive: parsed.data.isActive,
    },
  });

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_MEMBER_UPDATED",
    description: `Vinculo de ${membership.user.email} na equipe ${membership.team.name} atualizado por ${actor.email}.`,
    teamId,
    payload: JSON.stringify({
      userId: membership.userId,
      previousRole: membership.role,
      nextRole: parsed.data.role,
      previousIsActive: membership.isActive,
      nextIsActive: parsed.data.isActive,
    }),
  }).catch(() => undefined);

  revalidateTeamRoutes(teamId);

  return { success: `Vinculo de ${membership.user.name} atualizado.` };
}
