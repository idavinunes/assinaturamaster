import { Role, TeamMemberRole, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "assinaura_session";
const ACTIVE_TEAM_COOKIE_NAME = "assinaura_active_team";
const SESSION_DURATION_HOURS = 12;

export type SessionTeamMembership = {
  teamId: string;
  teamName: string;
  teamSlug: string;
  role: TeamMemberRole;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  memberships: SessionTeamMembership[];
  activeTeamId: string | null;
  activeTeam: SessionTeamMembership | null;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET nao configurado.");
  }

  return new TextEncoder().encode(secret);
}

function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
}

async function setActiveTeamCookie(teamId: string | null) {
  const cookieStore = await cookies();

  if (!teamId) {
    cookieStore.delete(ACTIVE_TEAM_COOKIE_NAME);
    return;
  }

  cookieStore.set(ACTIVE_TEAM_COOKIE_NAME, teamId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: sessionExpiresAt(),
  });
}

async function getUserTeamMemberships(userId: string): Promise<SessionTeamMembership[]> {
  const memberships = await prisma.userTeamMembership.findMany({
    where: {
      userId,
      isActive: true,
      team: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      role: true,
      teamId: true,
      team: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  return memberships
    .map((membership) => ({
      teamId: membership.teamId,
      teamName: membership.team.name,
      teamSlug: membership.team.slug,
      role: membership.role,
    }))
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "pt-BR"));
}

function resolveActiveTeam(
  memberships: SessionTeamMembership[],
  preferredTeamId?: string | null,
) {
  if (!memberships.length) {
    return null;
  }

  if (preferredTeamId) {
    const preferredMembership = memberships.find(
      (membership) => membership.teamId === preferredTeamId,
    );

    if (preferredMembership) {
      return preferredMembership;
    }
  }

  return memberships[0];
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return user;
}

export async function createUserSession(user: User) {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(getAuthSecret());

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: sessionExpiresAt(),
  });

  const memberships = await getUserTeamMemberships(user.id);
  const activeTeam = resolveActiveTeam(memberships);
  await setActiveTeamCookie(activeTeam?.teamId ?? null);
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(ACTIVE_TEAM_COOKIE_NAME);
}

export async function updateActiveTeamSelection(userId: string, teamId: string) {
  const memberships = await getUserTeamMemberships(userId);
  const membership = memberships.find((item) => item.teamId === teamId);

  if (!membership) {
    throw new Error("Equipe invalida para este usuario.");
  }

  await setActiveTeamCookie(membership.teamId);

  return membership;
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const preferredActiveTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE_NAME)?.value ?? null;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret());

    if (!payload.sub || !payload.email || !payload.name || !payload.role) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const memberships = await getUserTeamMemberships(user.id);
    const activeTeam = resolveActiveTeam(memberships, preferredActiveTeamId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      memberships,
      activeTeamId: activeTeam?.teamId ?? null,
      activeTeam,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/entrar");
  }

  return session;
}

export async function requireRole(allowedRoles: Role[]) {
  const session = await requireSession();

  if (!allowedRoles.includes(session.role)) {
    redirect("/painel");
  }

  return session;
}

export function getAdminRoles() {
  return [Role.SUPER_ADMIN, Role.ADMIN];
}

export function getEditorRoles() {
  return [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.OPERATOR];
}
