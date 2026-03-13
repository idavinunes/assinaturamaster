import test from "node:test";
import assert from "node:assert/strict";
import { Role, TemplateScope, TeamMemberRole } from "@prisma/client";
import {
  canCreateGlobalTemplatesInContext,
  canDeleteTemplateInContext,
  canEditTemplateInContext,
  canManageTemplatesInContext,
  resolveTemplateAccessRule,
  type TemplateAccessContextLike,
} from "../src/lib/template-access-core.ts";

function buildContext(
  overrides: Partial<TemplateAccessContextLike> = {},
): TemplateAccessContextLike {
  return {
    globalRole: Role.OPERATOR,
    activeTeamId: "team_1",
    teamRole: TeamMemberRole.OPERATOR,
    ...overrides,
  };
}

test("super admin can read all templates and create globals", () => {
  const context = buildContext({
    globalRole: Role.SUPER_ADMIN,
    activeTeamId: null,
    teamRole: null,
  });

  assert.deepEqual(resolveTemplateAccessRule(context), { kind: "all" });
  assert.equal(canCreateGlobalTemplatesInContext(context), true);
  assert.equal(canDeleteTemplateInContext(context), true);
});

test("team user reads globals plus active team templates", () => {
  const context = buildContext({
    activeTeamId: "team_alpha",
    teamRole: TeamMemberRole.MANAGER,
  });

  assert.deepEqual(resolveTemplateAccessRule(context), {
    kind: "global-and-team",
    teamId: "team_alpha",
  });
  assert.equal(canManageTemplatesInContext(context), true);
});

test("user without active team reads globals only", () => {
  const context = buildContext({
    activeTeamId: null,
    teamRole: null,
  });

  assert.deepEqual(resolveTemplateAccessRule(context), { kind: "global-only" });
  assert.equal(canManageTemplatesInContext(context), false);
});

test("team users can edit only their private templates", () => {
  const context = buildContext({
    activeTeamId: "team_alpha",
    teamRole: TeamMemberRole.ADMIN,
  });

  assert.equal(
    canEditTemplateInContext(context, {
      scope: TemplateScope.TEAM_PRIVATE,
      ownerTeamId: "team_alpha",
    }),
    true,
  );

  assert.equal(
    canEditTemplateInContext(context, {
      scope: TemplateScope.TEAM_PRIVATE,
      ownerTeamId: "team_beta",
    }),
    false,
  );

  assert.equal(
    canEditTemplateInContext(context, {
      scope: TemplateScope.GLOBAL,
      ownerTeamId: null,
    }),
    false,
  );
});
