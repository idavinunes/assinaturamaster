"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteClientDocumentAction,
  type ClientDocumentFormState,
} from "@/app/painel/clientes/actions";

type DeleteClientDocumentButtonProps = {
  clientId: string;
  documentId: string;
  label?: string;
  pendingLabel?: string;
  confirmMessage?: string;
  className?: string;
  errorClassName?: string;
};

const initialState: ClientDocumentFormState = {};

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
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function DeleteClientDocumentButton({
  clientId,
  documentId,
  label = "Apagar",
  pendingLabel = "Apagando...",
  confirmMessage = "Deseja apagar este documento do cliente? Essa acao nao pode ser desfeita.",
  className,
  errorClassName,
}: DeleteClientDocumentButtonProps) {
  const [state, formAction] = useActionState(
    deleteClientDocumentAction.bind(null, clientId, documentId),
    initialState,
  );

  return (
    <form
      action={formAction}
      className="grid gap-2"
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
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
