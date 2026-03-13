"use client";

import { startTransition, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserMembershipActionState } from "@/app/painel/usuarios/actions";
import { SubmitButton } from "@/components/submit-button";
import { teamMemberRoleOptions } from "@/lib/roles";

type UserTeamMembershipEditFormProps = {
  action: (
    state: UserMembershipActionState,
    formData: FormData,
  ) => Promise<UserMembershipActionState>;
  membership: {
    teamId: string;
    teamName: string;
    teamSlug: string;
    teamIsActive: boolean;
    role: string;
    isActive: boolean;
  };
};

const initialState: UserMembershipActionState = {};

export function UserTeamMembershipEditForm({
  action,
  membership,
}: UserTeamMembershipEditFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }, [router, state.success]);

  return (
    <form action={formAction} className="rounded-[24px] border border-line bg-white p-5">
      <div className="grid gap-4">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground">{membership.teamName}</p>
              <p className="mt-1 font-mono text-sm text-muted">/{membership.teamSlug}</p>
            </div>
            <span className="inline-flex rounded-full border border-line bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              equipe {membership.teamIsActive ? "ativa" : "inativa"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/painel/equipes/${membership.teamId}/editar`}
              className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-stone-50"
            >
              Abrir equipe
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="eyebrow text-muted">Papel na equipe</span>
            <select
              name="role"
              defaultValue={membership.role}
              className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            >
              {teamMemberRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-[22px] border border-line bg-stone-50 px-4 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={membership.isActive}
              className="size-4 rounded border-line"
            />
            Vinculo ativo
          </label>
        </div>
      </div>

      {state.error ? (
        <p className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Salvando..." className="button-primary button-primary-sm">
          Salvar vinculo
        </SubmitButton>
      </div>
    </form>
  );
}
