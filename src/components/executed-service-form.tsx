"use client";

import { useActionState, useState } from "react";
import type { ClientType } from "@prisma/client";
import type { ExecutedServiceFormState } from "@/app/painel/servicos-executados/actions";
import { SubmitButton } from "@/components/submit-button";
import { getClientDisplayName } from "@/lib/clients";
import {
  formatCpfOrCnpj,
  formatCurrencyBRL,
  formatCurrencyInput,
  formatStoredCurrencyInput,
  formatPercentageInput,
  normalizeCurrencyToDecimalString,
  normalizePercentageToDecimalString,
} from "@/lib/formatters/br";

type ClientOption = {
  id: string;
  clientType: ClientType;
  legalName: string | null;
  contactName: string | null;
  documentNumber: string | null;
  isActive: boolean;
};

type ServiceCatalogOption = {
  id: string;
  name: string;
  description: string | null;
  defaultAmount: string;
  defaultPercentage: string;
  isActive: boolean;
  scopeLabel?: string;
};

type ExecutedServiceFormProps = {
  action: (
    state: ExecutedServiceFormState,
    formData: FormData,
  ) => Promise<ExecutedServiceFormState>;
  submitLabel: string;
  pendingLabel: string;
  clients: ClientOption[];
  services: ServiceCatalogOption[];
  defaults?: {
    clientId?: string;
    serviceCatalogId?: string;
    identificationNumber?: string | null;
    eventAmount?: string;
    servicePercentage?: string;
    description?: string | null;
    returnToClientId?: string;
  };
};

const initialState: ExecutedServiceFormState = {};

function calculatePrestationAmount(params: {
  eventAmountInput: string;
  servicePercentageInput: string;
}) {
  const normalizedEventAmount = normalizeCurrencyToDecimalString(params.eventAmountInput);
  const normalizedPercentage = normalizePercentageToDecimalString(
    params.servicePercentageInput,
  );

  if (!normalizedEventAmount || !normalizedPercentage) {
    return "";
  }

  return ((Number(normalizedEventAmount) * Number(normalizedPercentage)) / 100).toFixed(2);
}

export function ExecutedServiceForm({
  action,
  submitLabel,
  pendingLabel,
  clients,
  services,
  defaults,
}: ExecutedServiceFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [clientId, setClientId] = useState(defaults?.clientId ?? "");
  const [serviceCatalogId, setServiceCatalogId] = useState(defaults?.serviceCatalogId ?? "");
  const [identificationNumber, setIdentificationNumber] = useState(
    defaults?.identificationNumber ?? "",
  );
  const [eventAmount, setEventAmount] = useState(
    formatStoredCurrencyInput(defaults?.eventAmount ?? ""),
  );
  const [servicePercentage, setServicePercentage] = useState(
    formatPercentageInput(defaults?.servicePercentage ?? ""),
  );
  const [description, setDescription] = useState(defaults?.description ?? "");

  const selectedService = services.find((service) => service.id === serviceCatalogId);
  const prestationAmount = calculatePrestationAmount({
    eventAmountInput: eventAmount,
    servicePercentageInput: servicePercentage,
  });

  function applyCatalogDefaults(nextServiceCatalogId: string) {
    const nextService = services.find((service) => service.id === nextServiceCatalogId);

    if (!nextService) {
      setEventAmount("");
      setServicePercentage("");
      setDescription("");
      return;
    }

    setEventAmount(formatStoredCurrencyInput(nextService.defaultAmount));
    setServicePercentage(formatPercentageInput(nextService.defaultPercentage));
    setDescription(nextService.description ?? "");
  }

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <input
        type="hidden"
        name="returnToClientId"
        value={defaults?.returnToClientId ?? ""}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Cliente</span>
          <select
            name="clientId"
            value={clientId}
            onChange={(event) => {
              setClientId(event.currentTarget.value);
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            required
          >
            <option value="" disabled>
              Selecione um cliente
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {getClientDisplayName(client)}
                {client.documentNumber
                  ? ` • ${formatCpfOrCnpj(client.documentNumber)}`
                  : ""}
                {client.isActive ? "" : " • inativo"}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Servico cadastrado</span>
          <select
            name="serviceCatalogId"
            value={serviceCatalogId}
            onChange={(event) => {
              const nextServiceCatalogId = event.currentTarget.value;
              setServiceCatalogId(nextServiceCatalogId);
              applyCatalogDefaults(nextServiceCatalogId);
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            required
          >
            <option value="" disabled>
              Selecione um servico
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
                {service.scopeLabel ? ` • ${service.scopeLabel}` : ""}
                {service.isActive ? "" : " • inativo"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-[0.9fr_0.7fr_0.5fr]">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Numero de identificacao</span>
          <input
            name="identificationNumber"
            value={identificationNumber}
            onChange={(event) => {
              setIdentificationNumber(event.currentTarget.value);
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="Ex.: NF-2026-00018 ou ID interno"
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
            name="servicePercentage"
            value={servicePercentage}
            inputMode="decimal"
            onInput={(event) => {
              setServicePercentage(formatPercentageInput(event.currentTarget.value));
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="10"
            required
          />
        </label>
      </div>

      <div className="rounded-[24px] border border-line bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Valor da prestacao
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">
          {prestationAmount ? formatCurrencyBRL(prestationAmount) : "Preencha valor e percentual"}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Calculado automaticamente como percentual sobre o valor do evento.
          {selectedService
            ? ` Base atual: ${selectedService.name}${selectedService.scopeLabel ? ` • ${selectedService.scopeLabel}` : ""}.`
            : ""}
        </p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">Descricao de evento</span>
        <textarea
          name="description"
          value={description}
          onChange={(event) => {
            setDescription(event.currentTarget.value);
          }}
          rows={6}
          className="rounded-[24px] border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          placeholder="Detalhe o evento executado para este cliente."
        />
      </label>

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
