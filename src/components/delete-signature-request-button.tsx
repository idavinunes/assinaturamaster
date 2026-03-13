"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteSignatureRequestAction, type SignatureRequestFormState } from "@/app/painel/assinaturas/actions";

type DeleteSignatureRequestButtonProps = {
  requestId: string;
  label?: string;
  pendingLabel?: string;
  confirmMessage?: string;
  className?: string;
  errorClassName?: string;
};

const initialState: SignatureRequestFormState = {};

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

export function DeleteSignatureRequestButton({
  requestId,
  label = "Apagar",
  pendingLabel = "Apagando...",
  confirmMessage = "Deseja apagar esta solicitacao? Essa acao nao pode ser desfeita.",
  className,
  errorClassName,
}: DeleteSignatureRequestButtonProps) {
  const [state, formAction] = useActionState(
    deleteSignatureRequestAction.bind(null, requestId),
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
