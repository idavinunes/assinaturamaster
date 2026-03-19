import test from "node:test";
import assert from "node:assert/strict";
import { formatTemplateTeamAccessSummary } from "../src/lib/templates.ts";

test("formatTemplateTeamAccessSummary handles one team", () => {
  assert.equal(formatTemplateTeamAccessSummary(["Equipe A"]), "Equipe A");
});

test("formatTemplateTeamAccessSummary handles two teams", () => {
  assert.equal(
    formatTemplateTeamAccessSummary(["Equipe A", "Equipe B"]),
    "Equipe A e Equipe B",
  );
});

test("formatTemplateTeamAccessSummary compresses long team lists", () => {
  assert.equal(
    formatTemplateTeamAccessSummary(["Equipe A", "Equipe B", "Equipe C"]),
    "Equipe A, Equipe B e +1",
  );
});
