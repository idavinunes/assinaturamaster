import test from "node:test";
import assert from "node:assert/strict";
import { Role, ServiceCatalogScope, TeamMemberRole } from "@prisma/client";
import {
  canCreateGlobalServiceCatalogInContext,
  canEditServiceCatalogInContext,
  canManageServiceCatalogInContext,
  resolveServiceCatalogAccessRule,
  type ServiceCatalogAccessContextLike,
} from "../src/lib/service-catalog-access-core.ts";

function buildContext(
  overrides: Partial<ServiceCatalogAccessContextLike> = {},
): ServiceCatalogAccessContextLike {
  return {
    globalRole: Role.OPERATOR,
    activeTeamId: "team_1",
    teamRole: TeamMemberRole.OPERATOR,
    ...overrides,
  };
}

test("super admin can read all service catalog items and create globals", () => {
  const context = buildContext({
    globalRole: Role.SUPER_ADMIN,
    activeTeamId: null,
    teamRole: null,
  });

  assert.deepEqual(resolveServiceCatalogAccessRule(context), { kind: "all" });
  assert.equal(canCreateGlobalServiceCatalogInContext(context), true);
});

test("team user reads globals plus active team service items", () => {
  const context = buildContext({
    activeTeamId: "team_alpha",
    teamRole: TeamMemberRole.MANAGER,
  });

  assert.deepEqual(resolveServiceCatalogAccessRule(context), {
    kind: "global-and-team",
    teamId: "team_alpha",
  });
  assert.equal(canManageServiceCatalogInContext(context), true);
});

test("user without active team reads globals only", () => {
  const context = buildContext({
    activeTeamId: null,
    teamRole: null,
  });

  assert.deepEqual(resolveServiceCatalogAccessRule(context), { kind: "global-only" });
  assert.equal(canManageServiceCatalogInContext(context), false);
});

test("team users can edit only their private service items", () => {
  const context = buildContext({
    activeTeamId: "team_alpha",
    teamRole: TeamMemberRole.ADMIN,
  });

  assert.equal(
    canEditServiceCatalogInContext(context, {
      scope: ServiceCatalogScope.TEAM_PRIVATE,
      ownerTeamId: "team_alpha",
    }),
    true,
  );

  assert.equal(
    canEditServiceCatalogInContext(context, {
      scope: ServiceCatalogScope.TEAM_PRIVATE,
      ownerTeamId: "team_beta",
    }),
    false,
  );

  assert.equal(
    canEditServiceCatalogInContext(context, {
      scope: ServiceCatalogScope.GLOBAL,
      ownerTeamId: null,
    }),
    false,
  );
});
