"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TeamMembershipFormState } from "@/app/painel/equipes/actions";
import { SubmitButton } from "@/components/submit-button";
import { teamMemberRoleOptions } from "@/lib/roles";

type TeamMemberCreateFormProps = {
  action: (
    state: TeamMembershipFormState,
    formData: FormData,
  ) => Promise<TeamMembershipFormState>;
  users: Array<{
    id: string;
    name: string;
    email: string;
  }>;
};

const initialState: TeamMembershipFormState = {};

export function TeamMemberCreateForm({
  action,
  users,
}: TeamMemberCreateFormProps) {
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
      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_auto] md:items-end">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Usuario</span>
          <select
            name="userId"
            defaultValue=""
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          >
            <option value="">Selecione um usuario ativo</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} • {user.email}
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

        <div className="flex flex-wrap gap-3">
          <SubmitButton pendingLabel="Salvando..." className="button-primary button-primary-sm w-full md:w-auto">
            Adicionar membro
          </SubmitButton>
        </div>
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
    </form>
  );
}
