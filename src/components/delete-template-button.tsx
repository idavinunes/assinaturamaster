"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteTemplateAction,
  type TemplateFormState,
} from "@/app/painel/modelos/actions";

type DeleteTemplateButtonProps = {
  templateId: string;
  label?: string;
  pendingLabel?: string;
  confirmMessage?: string;
  className?: string;
  errorClassName?: string;
};

const initialState: TemplateFormState = {};

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

export function DeleteTemplateButton({
  templateId,
  label = "Apagar modelo",
  pendingLabel = "Apagando...",
  confirmMessage = "Deseja apagar este modelo? Essa acao nao pode ser desfeita.",
  className,
  errorClassName,
}: DeleteTemplateButtonProps) {
  const [state, formAction] = useActionState(
    deleteTemplateAction.bind(null, templateId),
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
