import test from "node:test";
import assert from "node:assert/strict";
import { Role, TeamMemberRole } from "@prisma/client";
import {
  buildAccessContext,
  type SessionUserLike,
  type SessionTeamMembershipLike,
} from "../src/lib/access-control-core.ts";

function buildMembership(role: TeamMemberRole): SessionTeamMembershipLike {
  return {
    teamId: "team_1",
    teamName: "Operacao Principal",
    teamSlug: "operacao-principal",
    role,
  };
}

function buildSession(
  overrides: Partial<SessionUserLike> = {},
): SessionUserLike {
  return {
    id: "user_1",
    role: Role.OPERATOR,
    activeTeamId: "team_1",
    activeTeam: buildMembership(TeamMemberRole.OPERATOR),
    ...overrides,
  };
}

test("super admin receives global access and global capabilities", () => {
  const access = buildAccessContext(
    buildSession({
      role: Role.SUPER_ADMIN,
      activeTeamId: null,
      activeTeam: null,
    }),
  );

  assert.equal(access.accessLevel, "global");
  assert.equal(access.scope.teamId, null);
  assert.equal(access.scope.responsibleUserId, null);
  assert.equal(access.capabilities.manageGlobalAdministration, true);
  assert.equal(access.capabilities.transferPortfolio, true);
});

test("team manager receives team-wide visibility", () => {
  const access = buildAccessContext(
    buildSession({
      activeTeam: buildMembership(TeamMemberRole.MANAGER),
    }),
  );

  assert.equal(access.accessLevel, "team");
  assert.equal(access.scope.teamId, "team_1");
  assert.equal(access.scope.responsibleUserId, null);
  assert.equal(access.capabilities.viewTeamPortfolio, true);
  assert.equal(access.capabilities.viewUnassignedPortfolio, true);
});

test("operator remains restricted to assigned portfolio", () => {
  const access = buildAccessContext(buildSession());

  assert.equal(access.accessLevel, "assigned");
  assert.equal(access.scope.teamId, "team_1");
  assert.equal(access.scope.responsibleUserId, "user_1");
  assert.equal(access.capabilities.viewTeamPortfolio, false);
  assert.equal(access.capabilities.viewUnassignedPortfolio, false);
  assert.equal(access.capabilities.transferPortfolio, false);
});

test("user without active team cannot read operational data", () => {
  const access = buildAccessContext(
    buildSession({
      activeTeamId: null,
      activeTeam: null,
    }),
  );

  assert.equal(access.accessLevel, "assigned");
  assert.equal(access.capabilities.readOperationalData, false);
  assert.equal(access.capabilities.manageOperationalData, false);
});
