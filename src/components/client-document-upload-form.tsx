"use client";

import { useActionState } from "react";
import {
  uploadClientDocumentAction,
  type ClientDocumentFormState,
} from "@/app/painel/clientes/actions";
import {
  clientDocumentTypeLabels,
  clientDocumentTypeValues,
} from "@/lib/client-documents";
import { SubmitButton } from "@/components/submit-button";

type ClientDocumentUploadFormProps = {
  clientId: string;
  variant?: "card" | "embedded";
};

const initialState: ClientDocumentFormState = {};

export function ClientDocumentUploadForm({
  clientId,
  variant = "card",
}: ClientDocumentUploadFormProps) {
  const [state, formAction] = useActionState(
    uploadClientDocumentAction.bind(null, clientId),
    initialState,
  );

  return (
    <form
      action={formAction}
      className={
        variant === "embedded"
          ? "grid gap-4"
          : "grid gap-4 rounded-[24px] border border-line bg-white p-5"
      }
    >
      <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Tipo de documento</span>
          <select
            name="documentType"
            defaultValue="PRIMARY_DOCUMENT"
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          >
            {clientDocumentTypeValues.map((documentType) => (
              <option key={documentType} value={documentType}>
                {clientDocumentTypeLabels[documentType]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Descricao opcional</span>
          <input
            name="description"
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="Ex.: RG frente e verso, conta de luz, contrato social"
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Arquivo</span>
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-foreground hover:file:bg-stone-200 focus:border-accent"
          required
        />
        <p className="text-xs leading-5 text-muted">
          Arquive CPF/CNPJ, RG, comprovante de endereco ou outro anexo. Por
          enquanto o arquivo fica no armazenamento local do projeto, mas o
          registro ja esta preparado para migrar para S3 depois.
        </p>
      </label>

      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Enviando..." className="button-primary-sm">
          Enviar documento
        </SubmitButton>
      </div>
    </form>
  );
}
