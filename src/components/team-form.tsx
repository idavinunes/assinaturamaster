"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TeamFormState } from "@/app/painel/equipes/actions";
import { SubmitButton } from "@/components/submit-button";

type TeamFormProps = {
  action: (state: TeamFormState, formData: FormData) => Promise<TeamFormState>;
  submitLabel: string;
  pendingLabel: string;
  defaults?: {
    name?: string;
    slug?: string;
    description?: string | null;
    isActive?: boolean;
  };
  isEdit?: boolean;
};

const initialState: TeamFormState = {};

export function TeamForm({
  action,
  submitLabel,
  pendingLabel,
  defaults,
  isEdit = false,
}: TeamFormProps) {
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
    <form action={formAction} className="mt-6 grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Nome da equipe</span>
          <input
            name="name"
            defaultValue={defaults?.name}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Identificador</span>
          <input
            name="slug"
            defaultValue={defaults?.slug}
            placeholder="titans"
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 font-mono text-sm lowercase outline-none transition focus:border-accent"
            required
          />
          <p className="text-xs leading-5 text-muted">
            Use apenas letras minusculas, numeros e hifens.
          </p>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="eyebrow text-muted">Descricao</span>
        <textarea
          name="description"
          defaultValue={defaults?.description ?? ""}
          rows={4}
          className="rounded-[24px] border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          placeholder="Equipe comercial responsavel por uma carteira especifica."
        />
      </label>

      {isEdit ? (
        <label className="flex items-center gap-3 rounded-[22px] border border-line bg-white px-4 py-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={defaults?.isActive}
            className="size-4 rounded border-line"
          />
          Equipe ativa
        </label>
      ) : null}

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
        <SubmitButton pendingLabel={pendingLabel} className="button-primary">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
