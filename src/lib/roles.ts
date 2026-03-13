import { roleValues, teamMemberRoleValues } from "@/lib/validation/forms";

export type AppRole = (typeof roleValues)[number];
export type TeamMemberRoleValue = (typeof teamMemberRoleValues)[number];

export const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Administrador" },
  { value: "MANAGER", label: "Gerente" },
  { value: "OPERATOR", label: "Operador" },
  { value: "VIEWER", label: "Leitura" },
];

export const roleLabels: Record<AppRole, string> = Object.fromEntries(
  roleOptions.map((option) => [option.value, option.label]),
) as Record<AppRole, string>;

export const teamMemberRoleOptions: Array<{ value: TeamMemberRoleValue; label: string }> = [
  { value: "ADMIN", label: "Administrador da equipe" },
  { value: "MANAGER", label: "Gerente da equipe" },
  { value: "OPERATOR", label: "Operador" },
  { value: "VIEWER", label: "Leitura" },
];

export const teamMemberRoleLabels: Record<TeamMemberRoleValue, string> = Object.fromEntries(
  teamMemberRoleOptions.map((option) => [option.value, option.label]),
) as Record<TeamMemberRoleValue, string>;
