"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteExecutedServiceAction,
  type ExecutedServiceFormState,
} from "@/app/painel/servicos-executados/actions";

type DeleteExecutedServiceButtonProps = {
  executedServiceId: string;
  returnToClientId?: string;
  label?: string;
  pendingLabel?: string;
  confirmMessage?: string;
  className?: string;
  errorClassName?: string;
};

const initialState: ExecutedServiceFormState = {};

function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function DeleteExecutedServiceButton({
  executedServiceId,
  returnToClientId,
  label = "Apagar",
  pendingLabel = "Apagando...",
  confirmMessage = "Deseja apagar este servico executado? Essa acao nao pode ser desfeita.",
  className,
  errorClassName,
}: DeleteExecutedServiceButtonProps) {
  const [state, formAction] = useActionState(
    deleteExecutedServiceAction.bind(null, executedServiceId),
    initialState,
  );

  return (
    <form
      action={formAction}
      className="grid gap-2"
      onSubmit={(event) => {
        const confirmed = window.confirm(confirmMessage);

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      {returnToClientId ? (
        <input
          type="hidden"
          name="returnToClientId"
          value={returnToClientId}
        />
      ) : null}

      <SubmitButton
        label={label}
        pendingLabel={pendingLabel}
        className={className}
      />

      {state.error ? (
        <p className={errorClassName ?? "text-xs text-red-700"}>{state.error}</p>
      ) : null}
    </form>
  );
}
