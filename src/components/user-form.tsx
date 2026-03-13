"use client";

import { useActionState } from "react";
import { roleOptions, teamMemberRoleOptions } from "@/lib/roles";
import type { UserFormState } from "@/app/painel/usuarios/actions";
import { SubmitButton } from "@/components/submit-button";

type UserFormProps = {
  action: (state: UserFormState, formData: FormData) => Promise<UserFormState>;
  submitLabel: string;
  pendingLabel: string;
  defaults?: {
    name?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    initialTeamId?: string;
    initialTeamRole?: string;
  };
  isEdit?: boolean;
  teamOptions?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

const initialState: UserFormState = {};

export function UserForm({
  action,
  submitLabel,
  pendingLabel,
  defaults,
  isEdit = false,
  teamOptions = [],
}: UserFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Nome</span>
          <input
            name="name"
            defaultValue={defaults?.name}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">E-mail</span>
          <input
            name="email"
            type="email"
            defaultValue={defaults?.email}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">
            {isEdit ? "Nova senha" : "Senha inicial"}
          </span>
          <input
            name="password"
            type="password"
            placeholder={isEdit ? "Deixe em branco para manter a atual" : "Minimo de 8 caracteres"}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required={!isEdit}
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Papel global</span>
          <select
            name="role"
            defaultValue={defaults?.role}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!isEdit ? (
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="eyebrow text-muted">Equipe inicial</span>
            <select
              name="initialTeamId"
              defaultValue={defaults?.initialTeamId ?? ""}
              className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            >
              <option value="">Criar sem equipe inicial</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} • /{team.slug}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-muted">
              Se selecionar uma equipe, o usuario ja nasce vinculado ao ambiente.
            </p>
          </label>

          <label className="grid gap-2">
            <span className="eyebrow text-muted">Papel na equipe</span>
            <select
              name="initialTeamRole"
              defaultValue={defaults?.initialTeamRole ?? "OPERATOR"}
              className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            >
              {teamMemberRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {isEdit ? (
        <label className="flex items-center gap-3 rounded-[22px] border border-line bg-white px-4 py-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={defaults?.isActive}
            className="size-4 rounded border-line"
          />
          Usuario ativo
        </label>
      ) : null}

      {state.error ? (
        <p className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          pendingLabel={pendingLabel}
          className="button-primary"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
