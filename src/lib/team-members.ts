import { TeamMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const assignableOperationalRoles: TeamMemberRole[] = [
  TeamMemberRole.ADMIN,
  TeamMemberRole.MANAGER,
  TeamMemberRole.OPERATOR,
];

export type AssignableTeamMember = {
  userId: string;
  name: string;
  email: string;
  role: TeamMemberRole;
};

export async function listAssignableTeamMembers(teamId: string): Promise<AssignableTeamMember[]> {
  const memberships = await prisma.userTeamMembership.findMany({
    where: {
      teamId,
      isActive: true,
      role: {
        in: assignableOperationalRoles,
      },
      team: {
        is: {
          isActive: true,
        },
      },
      user: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      role: true,
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      {
        user: {
          name: "asc",
        },
      },
    ],
  });

  return memberships.map((membership) => ({
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
  }));
}

export async function findAssignableTeamMember(teamId: string, userId: string) {
  const membership = await prisma.userTeamMembership.findFirst({
    where: {
      teamId,
      userId,
      isActive: true,
      role: {
        in: assignableOperationalRoles,
      },
      team: {
        is: {
          isActive: true,
        },
      },
      user: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      role: true,
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
  } satisfies AssignableTeamMember;
}
