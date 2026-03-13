"use server";

import { Prisma, Role, TeamMemberRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canTransferOperationalOwnership,
  requireOperationalWriteAccess,
} from "@/lib/access-control";
import { getAdminRoles, requireRole } from "@/lib/auth";
import { registerUserAudit } from "@/lib/audit";
import {
  clearPortfolioResponsibilityInTeam,
  getPortfolioSummaryByTeamForUser,
  transferPortfolioBetweenUsersInTeam,
} from "@/lib/portfolio-management";
import { prisma } from "@/lib/prisma";
import { findAssignableTeamMember } from "@/lib/team-members";
import {
  createUserSchema,
  updateTeamMembershipSchema,
  updateUserSchema,
  upsertUserMembershipSchema,
} from "@/lib/validation/forms";

export type UserFormState = {
  error?: string;
};

export type UserPortfolioActionState = {
  error?: string;
  success?: string;
};

export type UserMembershipActionState = {
  error?: string;
  success?: string;
};

async function resolveInitialMembership(params: {
  teamId?: string;
  role?: TeamMemberRole;
}) {
  if (!params.teamId) {
    return null;
  }

  const team = await prisma.team.findFirst({
    where: {
      id: params.teamId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!team) {
    throw new Error("INVALID_INITIAL_TEAM");
  }

  return {
    team,
    role: params.role ?? TeamMemberRole.OPERATOR,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ja existe um usuario com esse e-mail.";
  }

  return "Nao foi possivel salvar o usuario.";
}

function formatPortfolioSummaryMessage(params: {
  clientsCount: number;
  executedServicesCount: number;
  signatureRequestsCount: number;
}) {
  return `${params.clientsCount} cliente(s), ${params.executedServicesCount} servico(s) executado(s) e ${params.signatureRequestsCount} assinatura(s)`;
}

async function getPendingPortfolioSummary(userId: string) {
  const portfolioByTeam = await getPortfolioSummaryByTeamForUser(userId);
  const totalCount = portfolioByTeam.reduce((sum, item) => sum + item.totalCount, 0);

  return {
    portfolioByTeam,
    totalCount,
  };
}

async function ensureUserCanBeDeactivated(userId: string) {
  const pendingPortfolio = await getPendingPortfolioSummary(userId);

  if (pendingPortfolio.totalCount === 0) {
    return null;
  }

  const summary = pendingPortfolio.portfolioByTeam
    .map(
      (item) =>
        `${item.teamName}: ${formatPortfolioSummaryMessage({
          clientsCount: item.clientsCount,
          executedServicesCount: item.executedServicesCount,
          signatureRequestsCount: item.signatureRequestsCount,
        })}`,
    )
    .join(" | ");

  return `Transfira a carteira antes de inativar este usuario. Pendencias: ${summary}.`;
}

function revalidateUserManagementRoutes(userId: string, teamId?: string) {
  revalidatePath("/painel", "layout");
  revalidatePath("/painel");
  revalidatePath("/painel/usuarios");
  revalidatePath(`/painel/usuarios/${userId}/editar`);
  revalidatePath("/painel/equipes");

  if (teamId) {
    revalidatePath(`/painel/equipes/${teamId}/editar`);
  }
}

async function ensureSelfRetainsActiveMembership(params: {
  actorId: string;
  userId: string;
  membershipId: string;
  nextIsActive: boolean;
}) {
  if (params.actorId !== params.userId || params.nextIsActive) {
    return;
  }

  const activeMembershipsCount = await prisma.userTeamMembership.count({
    where: {
      userId: params.userId,
      isActive: true,
    },
  });

  if (activeMembershipsCount <= 1) {
    throw new Error("LAST_ACTIVE_MEMBERSHIP");
  }
}

export async function createUserAction(
  _previousState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const actor = await requireRole(getAdminRoles());
  const parsed = createUserSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
    initialTeamId: String(formData.get("initialTeamId") ?? ""),
    initialTeamRole: String(formData.get("initialTeamRole") ?? "OPERATOR"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const initialMembership = await resolveInitialMembership({
      teamId: parsed.data.initialTeamId,
      role: parsed.data.initialTeamRole as TeamMemberRole | undefined,
    });
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email: normalizeEmail(parsed.data.email),
        passwordHash,
        role: parsed.data.role,
        ...(initialMembership
          ? {
              teamMemberships: {
                create: {
                  teamId: initialMembership.team.id,
                  role: initialMembership.role,
                  isActive: true,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
      },
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "USER_CREATED",
      description: initialMembership
        ? `Usuario ${normalizeEmail(parsed.data.email)} criado por ${actor.email} e vinculado a equipe ${initialMembership.team.name}.`
        : `Usuario ${normalizeEmail(parsed.data.email)} criado por ${actor.email}.`,
    });

    if (initialMembership) {
      await registerUserAudit({
        actorUserId: actor.id,
        action: "TEAM_MEMBER_UPSERTED",
        description: `Usuario ${user.email} vinculado a equipe ${initialMembership.team.name} como ${initialMembership.role} por ${actor.email}.`,
        teamId: initialMembership.team.id,
        payload: JSON.stringify({
          userId: user.id,
          role: initialMembership.role,
        }),
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_INITIAL_TEAM") {
      return { error: "Selecione uma equipe ativa valida para o usuario." };
    }

    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/equipes");
  revalidatePath("/painel/usuarios");
  redirect("/painel/usuarios");
}

export async function updateUserAction(
  userId: string,
  _previousState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const actor = await requireRole(getAdminRoles());
  const parsed = updateUserSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  if (actor.id === userId && !parsed.data.isActive) {
    return { error: "Voce nao pode inativar a propria conta." };
  }

  if (!parsed.data.isActive) {
    const deactivationError = await ensureUserCanBeDeactivated(userId);

    if (deactivationError) {
      return { error: deactivationError };
    }
  }

  const updateData: {
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
    passwordHash?: string;
  } = {
    name: parsed.data.name.trim(),
    email: normalizeEmail(parsed.data.email),
    role: parsed.data.role,
    isActive: parsed.data.isActive,
  };

  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "USER_UPDATED",
      description: `Usuario ${updateData.email} atualizado por ${actor.email}.`,
    });
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/painel");
  revalidatePath("/painel/usuarios");
  revalidatePath(`/painel/usuarios/${userId}/editar`);
  redirect("/painel/usuarios");
}

export async function createUserMembershipAction(
  userId: string,
  _previousState: UserMembershipActionState,
  formData: FormData,
): Promise<UserMembershipActionState> {
  const actor = await requireRole(getAdminRoles());
  const parsed = upsertUserMembershipSchema.safeParse({
    teamId: String(formData.get("teamId") ?? "").trim(),
    role: String(formData.get("role") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const [user, team] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
    prisma.team.findFirst({
      where: {
        id: parsed.data.teamId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!user) {
    return { error: "Usuario nao encontrado." };
  }

  if (!team) {
    return { error: "Selecione uma equipe ativa valida." };
  }

  await prisma.userTeamMembership.upsert({
    where: {
      userId_teamId: {
        userId,
        teamId: team.id,
      },
    },
    update: {
      role: parsed.data.role,
      isActive: true,
    },
    create: {
      userId,
      teamId: team.id,
      role: parsed.data.role,
      isActive: true,
    },
  });

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_MEMBER_UPSERTED",
    description: `Usuario ${user.email} vinculado a equipe ${team.name} como ${parsed.data.role} por ${actor.email}.`,
    teamId: team.id,
    payload: JSON.stringify({
      userId,
      role: parsed.data.role,
    }),
  }).catch(() => undefined);

  revalidateUserManagementRoutes(userId, team.id);

  return { success: `${user.name} agora participa da equipe ${team.name}.` };
}

export async function updateUserMembershipAction(
  userId: string,
  membershipId: string,
  _previousState: UserMembershipActionState,
  formData: FormData,
): Promise<UserMembershipActionState> {
  const actor = await requireRole(getAdminRoles());
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
      userId,
    },
    select: {
      id: true,
      userId: true,
      role: true,
      isActive: true,
      teamId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      team: {
        select: {
          name: true,
          isActive: true,
        },
      },
    },
  });

  if (!membership) {
    return { error: "Vinculo de equipe nao encontrado." };
  }

  if (!membership.team.isActive && parsed.data.isActive) {
    return { error: "Nao ative o vinculo enquanto a equipe estiver inativa." };
  }

  try {
    await ensureSelfRetainsActiveMembership({
      actorId: actor.id,
      userId,
      membershipId,
      nextIsActive: parsed.data.isActive,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ACTIVE_MEMBERSHIP") {
      return { error: "Mantenha ao menos uma equipe ativa vinculada ao proprio usuario." };
    }

    throw error;
  }

  await prisma.userTeamMembership.update({
    where: { id: membershipId },
    data: {
      role: parsed.data.role,
      isActive: parsed.data.isActive,
    },
  });

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_MEMBER_UPDATED",
    description: `Vinculo de ${membership.user.email} na equipe ${membership.team.name} atualizado por ${actor.email}.`,
    teamId: membership.teamId,
    payload: JSON.stringify({
      userId,
      previousRole: membership.role,
      nextRole: parsed.data.role,
      previousIsActive: membership.isActive,
      nextIsActive: parsed.data.isActive,
    }),
  }).catch(() => undefined);

  revalidateUserManagementRoutes(userId, membership.teamId);

  return { success: `Vinculo de ${membership.user.name} atualizado.` };
}

export async function toggleUserStatusAction(userId: string) {
  const actor = await requireRole(getAdminRoles());
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      isActive: true,
    },
  });

  if (!user) {
    return;
  }

  if (user.id === actor.id) {
    return;
  }

  const nextStatus = !user.isActive;

  if (!nextStatus) {
    const deactivationError = await ensureUserCanBeDeactivated(userId);

    if (deactivationError) {
      redirect(`/painel/usuarios/${userId}/editar`);
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: nextStatus,
    },
  });

  await registerUserAudit({
    actorUserId: actor.id,
    action: nextStatus ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    description: `Usuario ${user.email} ${nextStatus ? "reativado" : "inativado"} por ${actor.email}.`,
  });

  revalidatePath("/painel");
  revalidatePath("/painel/usuarios");
  revalidatePath(`/painel/usuarios/${userId}/editar`);
}

export async function manageUserPortfolioAction(
  userId: string,
  _previousState: UserPortfolioActionState,
  formData: FormData,
): Promise<UserPortfolioActionState> {
  const actor = await requireOperationalWriteAccess();

  if (!canTransferOperationalOwnership(actor) || !actor.activeTeamId || !actor.activeTeam) {
    return { error: "Voce nao possui permissao para redistribuir carteira nesta equipe." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return { error: "Usuario nao encontrado." };
  }

  const pendingPortfolio = await getPortfolioSummaryByTeamForUser(userId);
  const activeTeamPortfolio = pendingPortfolio.find(
    (item) => item.teamId === actor.activeTeamId,
  );

  if (!activeTeamPortfolio || activeTeamPortfolio.totalCount === 0) {
    return { error: "Nao ha carteira pendente para este usuario na equipe ativa." };
  }

  const mode = String(formData.get("mode") ?? "").trim();

  if (mode !== "transfer" && mode !== "unassign") {
    return { error: "Selecione uma acao valida para a carteira." };
  }

  if (mode === "transfer") {
    const targetUserId = String(formData.get("targetUserId") ?? "").trim();

    if (!targetUserId) {
      return { error: "Selecione um membro da equipe para receber a carteira." };
    }

    if (targetUserId === userId) {
      return { error: "Selecione outro membro da equipe para receber a carteira." };
    }

    const targetUser = await findAssignableTeamMember(actor.activeTeamId, targetUserId);

    if (!targetUser) {
      return { error: "Selecione um membro ativo da equipe para receber a carteira." };
    }

    const result = await transferPortfolioBetweenUsersInTeam({
      teamId: actor.activeTeamId,
      fromUserId: userId,
      toUserId: targetUser.userId,
    });

    await registerUserAudit({
      actorUserId: actor.id,
      action: "TEAM_PORTFOLIO_TRANSFERRED",
      description: `Carteira da equipe ${actor.activeTeam.teamName} transferida de ${user.email} para ${targetUser.email} por ${actor.email}.`,
      payload: JSON.stringify({
        teamId: actor.activeTeamId,
        fromUserId: userId,
        toUserId: targetUser.userId,
        counts: result,
      }),
      teamId: actor.activeTeamId,
    }).catch(() => undefined);

    revalidatePath("/painel");
    revalidatePath("/painel/clientes");
    revalidatePath("/painel/servicos-executados");
    revalidatePath("/painel/assinaturas");
    revalidatePath("/painel/usuarios");
    revalidatePath(`/painel/usuarios/${userId}/editar`);

    return {
      success: `Carteira transferida para ${targetUser.name}: ${formatPortfolioSummaryMessage(result)}.`,
    };
  }

  const result = await clearPortfolioResponsibilityInTeam({
    teamId: actor.activeTeamId,
    userId,
  });

  await registerUserAudit({
    actorUserId: actor.id,
    action: "TEAM_PORTFOLIO_UNASSIGNED",
    description: `Carteira da equipe ${actor.activeTeam.teamName} de ${user.email} liberada para fila sem responsavel por ${actor.email}.`,
    payload: JSON.stringify({
      teamId: actor.activeTeamId,
      userId,
      counts: result,
    }),
    teamId: actor.activeTeamId,
  }).catch(() => undefined);

  revalidatePath("/painel");
  revalidatePath("/painel/clientes");
  revalidatePath("/painel/servicos-executados");
  revalidatePath("/painel/assinaturas");
  revalidatePath("/painel/usuarios");
  revalidatePath(`/painel/usuarios/${userId}/editar`);

  return {
    success: `Carteira movida para a fila sem responsavel: ${formatPortfolioSummaryMessage(result)}.`,
  };
}
