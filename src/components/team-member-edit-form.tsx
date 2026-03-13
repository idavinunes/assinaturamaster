"use client";

import { startTransition, useActionState, useEffect } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import type { TeamMembershipFormState } from "@/app/painel/equipes/actions";
import { SubmitButton } from "@/components/submit-button";
import { roleLabels, teamMemberRoleOptions } from "@/lib/roles";

type TeamMemberEditFormProps = {
  action: (
    state: TeamMembershipFormState,
    formData: FormData,
  ) => Promise<TeamMembershipFormState>;
  membership: {
    userName: string;
    userEmail: string;
    userRole: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

const initialState: TeamMembershipFormState = {};

export function TeamMemberEditForm({
  action,
  membership,
}: TeamMemberEditFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);
  const initials = membership.userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!state.success) {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }, [router, state.success]);

  return (
    <form action={formAction} className="rounded-[24px] border border-line bg-white p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl border border-line bg-stone-50 text-xs font-semibold text-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{membership.userName}</p>
                <span
                  className={clsx(
                    "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                    membership.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-600",
                  )}
                >
                  {membership.isActive ? "Ativo" : "Pausado"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{membership.userEmail}</p>
              <p className="mt-2 font-mono text-xs text-muted">
                papel global: {roleLabels[membership.userRole as keyof typeof roleLabels]}
              </p>
              <p className="mt-1 text-xs text-muted">
                vinculo criado em {membership.createdAt.toLocaleDateString("pt-BR")} • atualizado em{" "}
                {membership.updatedAt.toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:min-w-[280px]">
          <label className="grid gap-2">
            <span className="eyebrow text-muted">Papel na equipe</span>
            <select
              name="role"
              defaultValue={membership.role}
              className="rounded-[22px] border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
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
