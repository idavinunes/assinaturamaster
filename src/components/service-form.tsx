"use client";

import { useActionState, useState } from "react";
import type { ServiceCatalogScope } from "@prisma/client";
import type { ServiceCatalogFormState } from "@/app/painel/servicos/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  formatCurrencyBRL,
  formatCurrencyInput,
  formatStoredCurrencyInput,
  formatPercentageInput,
  normalizeCurrencyToDecimalString,
  normalizePercentageToDecimalString,
} from "@/lib/formatters/br";

type ServiceFormProps = {
  action: (
    state: ServiceCatalogFormState,
    formData: FormData,
  ) => Promise<ServiceCatalogFormState>;
  submitLabel: string;
  pendingLabel: string;
  defaults?: {
    name?: string;
    eventAmount?: string;
    defaultPercentage?: string;
    description?: string | null;
    isActive?: boolean;
    scope?: ServiceCatalogScope;
  };
  isEdit?: boolean;
  scopeField: {
    mode: "select" | "hidden";
    value: ServiceCatalogScope;
    helper?: string;
    lockedLabel?: string;
    options?: Array<{
      value: ServiceCatalogScope;
      label: string;
    }>;
  };
};

const initialState: ServiceCatalogFormState = {};

function calculateDefaultPrestationAmount(params: {
  eventAmountInput: string;
  percentageInput: string;
}) {
  const normalizedEventAmount = normalizeCurrencyToDecimalString(params.eventAmountInput);
  const normalizedPercentage = normalizePercentageToDecimalString(params.percentageInput);

  if (!normalizedEventAmount || !normalizedPercentage) {
    return "";
  }

  return ((Number(normalizedEventAmount) * Number(normalizedPercentage)) / 100).toFixed(2);
}

export function ServiceForm({
  action,
  submitLabel,
  pendingLabel,
  defaults,
  isEdit = false,
  scopeField,
}: ServiceFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [eventAmount, setEventAmount] = useState(
    formatStoredCurrencyInput(defaults?.eventAmount ?? ""),
  );
  const [defaultPercentage, setDefaultPercentage] = useState(
    formatPercentageInput(defaults?.defaultPercentage ?? ""),
  );
  const defaultPrestationAmount = calculateDefaultPrestationAmount({
    eventAmountInput: eventAmount,
    percentageInput: defaultPercentage,
  });

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      {scopeField.mode === "hidden" ? (
        <input type="hidden" name="scope" value={scopeField.value} />
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1.15fr_0.8fr_0.6fr]">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Servico</span>
          <input
            name="name"
            defaultValue={defaults?.name ?? ""}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="Ex.: Consultoria tributaria mensal"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Valor de evento</span>
          <input
            name="eventAmount"
            value={eventAmount}
            inputMode="numeric"
            onInput={(event) => {
              setEventAmount(formatCurrencyInput(event.currentTarget.value));
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="1.500,00"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">% de prestacao</span>
          <input
            name="defaultPercentage"
            value={defaultPercentage}
            inputMode="decimal"
            onInput={(event) => {
              setDefaultPercentage(formatPercentageInput(event.currentTarget.value));
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="10"
            required
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
        {scopeField.mode === "select" ? (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Visibilidade</span>
            <select
              name="scope"
              defaultValue={defaults?.scope ?? scopeField.value}
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            >
              {scopeField.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="rounded-[24px] border border-line bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Visibilidade
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {scopeField.lockedLabel ?? scopeField.value}
            </p>
          </div>
        )}

        {scopeField.helper ? (
          <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-muted">
            {scopeField.helper}
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-line bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Valor calculado da prestacao
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">
          {defaultPrestationAmount
            ? formatCurrencyBRL(defaultPrestationAmount)
            : "Preencha valor e percentual"}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Calculado automaticamente a partir do percentual informado sobre o valor do evento.
        </p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Descricao de evento</span>
        <textarea
          name="description"
          defaultValue={defaults?.description ?? ""}
          rows={6}
          className="rounded-[24px] border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          placeholder="Detalhe o evento base, o escopo e as observacoes principais."
        />
      </label>

      {isEdit ? (
        <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={defaults?.isActive}
            className="size-4 rounded border-line"
          />
          Servico ativo
        </label>
      ) : null}

      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          pendingLabel={pendingLabel}
          className="button-primary"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
