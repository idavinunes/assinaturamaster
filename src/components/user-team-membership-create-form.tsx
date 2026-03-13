"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { UserMembershipActionState } from "@/app/painel/usuarios/actions";
import { SubmitButton } from "@/components/submit-button";
import { teamMemberRoleOptions } from "@/lib/roles";

type UserTeamMembershipCreateFormProps = {
  action: (
    state: UserMembershipActionState,
    formData: FormData,
  ) => Promise<UserMembershipActionState>;
  teams: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

const initialState: UserMembershipActionState = {};

export function UserTeamMembershipCreateForm({
  action,
  teams,
}: UserTeamMembershipCreateFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    formRef.current?.reset();
    startTransition(() => {
      router.refresh();
    });
  }, [router, state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[1.3fr_0.9fr]">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Equipe</span>
          <select
            name="teamId"
            defaultValue=""
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          >
            <option value="">Selecione uma equipe ativa</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} • /{team.slug}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Papel na equipe</span>
          <select
            name="role"
            defaultValue="OPERATOR"
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          >
            {teamMemberRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.error ? (
        <p className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Salvando..." className="button-primary button-primary-sm">
          Vincular equipe
        </SubmitButton>
      </div>
    </form>
  );
}
