"use client";

import { useActionState, useState } from "react";
import type { ClientType, TemplateScope, TemplateStatus } from "@prisma/client";
import type { SignatureRequestFormState } from "@/app/painel/assinaturas/actions";
import { SubmitButton } from "@/components/submit-button";
import { getClientDisplayName } from "@/lib/clients";
import {
  formatBrazilPhone,
  formatCpfOrCnpj,
  formatCurrencyBRL,
  formatPercentageBR,
} from "@/lib/formatters/br";
import {
  manageableSignatureRequestStatusValues,
  signatureRequestStatusLabels,
} from "@/lib/signature-requests";
import { templateScopeLabels, templateStatusLabels } from "@/lib/templates";

type ClientOption = {
  id: string;
  clientType: ClientType;
  legalName: string | null;
  contactName: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

type ExecutedServiceOption = {
  id: string;
  clientId: string;
  identificationNumber: string | null;
  eventAmount: string;
  servicePercentage: string;
  amount: string;
  serviceCatalog: {
    name: string;
  };
};

type TemplateOption = {
  id: string;
  name: string;
  version: number;
  status: TemplateStatus;
  scope: TemplateScope;
  ownerTeam?: {
    name: string;
  } | null;
};

type SignatureRequestFormProps = {
  action: (
    state: SignatureRequestFormState,
    formData: FormData,
  ) => Promise<SignatureRequestFormState>;
  submitLabel: string;
  pendingLabel: string;
  clients: ClientOption[];
  executedServices: ExecutedServiceOption[];
  templates: TemplateOption[];
  defaults?: {
    title?: string;
    clientId?: string;
    serviceId?: string;
    templateId?: string;
    signerName?: string;
    signerEmail?: string;
    signerDocument?: string | null;
    signerPhone?: string | null;
    status?: "DRAFT" | "SENT" | "CANCELED";
    expiresAt?: string | null;
  };
};

const initialState: SignatureRequestFormState = {};

function truncateMiddle(value: string, maxLength = 22) {
  if (value.length <= maxLength) {
    return value;
  }

  const sideLength = Math.max(4, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, sideLength)}...${value.slice(-sideLength)}`;
}

function buildExecutedServiceOptionLabel(service: ExecutedServiceOption) {
  const parts = [service.serviceCatalog.name];

  if (service.identificationNumber) {
    parts.push(`ID ${truncateMiddle(service.identificationNumber, 18)}`);
  }

  parts.push(`Prest. ${formatCurrencyBRL(service.amount)}`);

  return parts.join(" • ");
}

export function SignatureRequestForm({
  action,
  submitLabel,
  pendingLabel,
  clients,
  executedServices,
  templates,
  defaults,
}: SignatureRequestFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [clientId, setClientId] = useState(defaults?.clientId ?? "");
  const [serviceId, setServiceId] = useState(defaults?.serviceId ?? "");
  const [templateId, setTemplateId] = useState(
    defaults?.templateId ?? (templates.length === 1 ? templates[0].id : ""),
  );
  const [signerName, setSignerName] = useState(defaults?.signerName ?? "");
  const [signerEmail, setSignerEmail] = useState(defaults?.signerEmail ?? "");
  const [signerDocument, setSignerDocument] = useState(
    formatCpfOrCnpj(defaults?.signerDocument ?? ""),
  );
  const [signerPhone, setSignerPhone] = useState(
    formatBrazilPhone(defaults?.signerPhone ?? ""),
  );

  const selectedClient = clients.find((client) => client.id === clientId);
  const isBusinessClient = selectedClient?.clientType === "BUSINESS";
  const signerNameLabel = isBusinessClient
    ? "Nome do representante para assinatura"
    : "Nome do assinante";
  const signerNamePlaceholder = isBusinessClient
    ? "Informe quem vai assinar pela empresa"
    : "Nome do assinante";

  const filteredServices = executedServices.filter((service) =>
    clientId ? service.clientId === clientId : true,
  );
  const selectedExecutedService = executedServices.find((service) => service.id === serviceId);
  const servicePlaceholder = clientId
    ? filteredServices.length > 0
      ? "Selecione um servico executado"
      : "Nenhum servico disponivel para nova assinatura"
    : "Escolha o cliente primeiro";

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Titulo da solicitacao</span>
          <input
            name="title"
            defaultValue={defaults?.title ?? ""}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="Ex.: Contrato de consultoria abril 2026"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Status</span>
          <select
            name="status"
            defaultValue={defaults?.status ?? "DRAFT"}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            required
          >
            {manageableSignatureRequestStatusValues.map((status) => (
              <option key={status} value={status}>
                {signatureRequestStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Cliente</span>
          <select
            name="clientId"
            value={clientId}
            onChange={(event) => {
              const nextClientId = event.currentTarget.value;
              const nextClient = clients.find((client) => client.id === nextClientId);
              setClientId(nextClientId);
              setServiceId((currentServiceId) =>
                executedServices.some(
                  (service) =>
                    service.id === currentServiceId && service.clientId === nextClientId,
                )
                  ? currentServiceId
                  : "",
              );

              if (!nextClient) {
                return;
              }

              setSignerEmail(nextClient.email ?? "");
              setSignerPhone(formatBrazilPhone(nextClient.phone ?? ""));

              if (nextClient.clientType === "PERSONAL") {
                setSignerName(nextClient.contactName ?? nextClient.legalName ?? "");
                setSignerDocument(formatCpfOrCnpj(nextClient.documentNumber ?? ""));
                return;
              }

              setSignerName("");
              setSignerDocument("");
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
                {client.documentNumber ? ` • ${formatCpfOrCnpj(client.documentNumber)}` : ""}
                {client.isActive ? "" : " • inativo"}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Servico executado</span>
          <select
            name="serviceId"
            value={serviceId}
            onChange={(event) => {
              setServiceId(event.currentTarget.value);
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            required
          >
            <option value="" disabled>
              {servicePlaceholder}
            </option>
            {filteredServices.map((service) => (
              <option key={service.id} value={service.id}>
                {buildExecutedServiceOptionLabel(service)}
              </option>
            ))}
          </select>
          {selectedExecutedService ? (
            <p className="text-xs leading-5 text-muted">
              {selectedExecutedService.identificationNumber
                ? `ID ${selectedExecutedService.identificationNumber} • `
                : ""}
              Evento {formatCurrencyBRL(selectedExecutedService.eventAmount)}
              {` • ${formatPercentageBR(selectedExecutedService.servicePercentage)}`}
              {` • Prestacao ${formatCurrencyBRL(selectedExecutedService.amount)}`}
            </p>
          ) : clientId && filteredServices.length === 0 ? (
            <p className="text-xs leading-5 text-muted">
              Os servicos ja vinculados a outra assinatura nao aparecem nesta lista.
            </p>
          ) : null}
        </label>
      </div>

      <label className="grid gap-2">
        <span className="eyebrow text-muted">Modelo</span>
        <select
          name="templateId"
          value={templateId}
          onChange={(event) => {
            setTemplateId(event.currentTarget.value);
          }}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          required
        >
          <option value="" disabled>
            Selecione um modelo
          </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} v{template.version} • {templateScopeLabels[template.scope]}
                {template.scope === "TEAM_PRIVATE" && template.ownerTeam?.name
                  ? ` (${template.ownerTeam.name})`
                  : ""}
                {` • ${templateStatusLabels[template.status]}`}
              </option>
            ))}
        </select>
        {templates.length === 0 ? (
          <p className="text-xs leading-5 text-muted">
            Cadastre ou ative um modelo antes de gerar a assinatura.
          </p>
        ) : null}
      </label>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">{signerNameLabel}</span>
          <input
            name="signerName"
            value={signerName}
            onChange={(event) => {
              setSignerName(event.currentTarget.value);
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder={signerNamePlaceholder}
            required
          />
          {!isBusinessClient && selectedClient ? (
            <p className="text-xs leading-5 text-muted">
              Preenchido com base no cadastro do cliente.
            </p>
          ) : null}
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">E-mail do assinante</span>
          <input
            name="signerEmail"
            type="email"
            value={signerEmail}
            onChange={(event) => {
              setSignerEmail(event.currentTarget.value);
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            required
          />
        </label>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_0.9fr_0.7fr]">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">CPF ou CNPJ do assinante</span>
          <input
            name="signerDocument"
            value={signerDocument}
            inputMode="numeric"
            maxLength={18}
            onInput={(event) => {
              setSignerDocument(formatCpfOrCnpj(event.currentTarget.value));
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="Opcional"
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Telefone do assinante</span>
          <input
            name="signerPhone"
            value={signerPhone}
            inputMode="numeric"
            maxLength={15}
            onInput={(event) => {
              setSignerPhone(formatBrazilPhone(event.currentTarget.value));
            }}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
            placeholder="Opcional"
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Expira em</span>
          <input
            name="expiresAt"
            type="date"
            defaultValue={defaults?.expiresAt ?? ""}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          />
        </label>
      </div>

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
