"use client";

import { ChevronRight } from "lucide-react";
import { clientTypeLabels, type ClientTypeValue } from "@/lib/clients";
import { formatBrazilPhone, formatCpfOrCnpj } from "@/lib/formatters/br";
import { useActionState, useState } from "react";
import type { ClientFormState } from "@/app/painel/clientes/actions";
import { SubmitButton } from "@/components/submit-button";

type ClientFormProps = {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  submitLabel: string;
  pendingLabel: string;
  defaults?: {
    clientType?: ClientTypeValue;
    legalName?: string | null;
    documentNumber?: string;
    responsibleUserId?: string | null;
    contactName?: string | null;
    civilStatus?: string | null;
    rg?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
    isActive?: boolean;
  };
  responsibleOptions?: Array<{
    value: string;
    label: string;
    helper: string;
  }>;
  allowResponsibleSelection?: boolean;
  responsibleSummary?: string | null;
  isEdit?: boolean;
};

const initialState: ClientFormState = {};

export function ClientForm({
  action,
  submitLabel,
  pendingLabel,
  defaults,
  responsibleOptions = [],
  allowResponsibleSelection = false,
  responsibleSummary,
  isEdit = false,
}: ClientFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const [clientType, setClientType] = useState<ClientTypeValue>(
    defaults?.clientType ?? "BUSINESS",
  );
  const isBusiness = clientType === "BUSINESS";

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <section className="grid gap-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
        <div>
          <p className="eyebrow text-slate-400">Identificação</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Base do cadastro
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Defina o tipo do cliente, o documento principal e o nome que vai
            aparecer nas buscas e contratos.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[0.45fr_0.95fr_0.8fr]">
          <label className="grid gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Tipo</span>
            <select
              name="clientType"
              value={clientType}
              onChange={(event) => {
                setClientType(event.currentTarget.value as ClientTypeValue);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="BUSINESS">{clientTypeLabels.BUSINESS}</option>
              <option value="PERSONAL">{clientTypeLabels.PERSONAL}</option>
            </select>
          </label>

          {isBusiness ? (
            <label key="business-name" className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Razão social</span>
              <input
                name="legalName"
                defaultValue={defaults?.legalName ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                required
              />
            </label>
          ) : (
            <label key="personal-name" className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Nome completo</span>
              <input
                name="contactName"
                defaultValue={defaults?.contactName ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="Nome da pessoa"
                required
              />
            </label>
          )}

          <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {isBusiness ? "CNPJ" : "CPF"}
              </span>
            <input
              name="documentNumber"
              defaultValue={formatCpfOrCnpj(defaults?.documentNumber ?? "")}
              inputMode="numeric"
              maxLength={18}
              onInput={(event) => {
                event.currentTarget.value = formatCpfOrCnpj(event.currentTarget.value);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              required
            />
          </label>
        </div>
      </section>

      <section className="grid gap-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
        <div>
          <p className="eyebrow text-slate-400">Contato</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Pessoa e canais de contato
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Aqui entram o responsavel principal, documento complementar e os
            meios de contato usados pela operacao.
          </p>
        </div>

        {isBusiness ? (
          <div key="business-contact-row" className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2 xl:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Nome do contato</span>
              <input
                name="contactName"
                defaultValue={defaults?.contactName ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="Nome do responsavel"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Estado civil</span>
              <input
                name="civilStatus"
                defaultValue={defaults?.civilStatus ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="Ex.: Casado(a)"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">RG</span>
              <input
                name="rg"
                defaultValue={defaults?.rg ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="RG do responsavel"
              />
            </label>

            <label className="grid gap-2 xl:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">E-mail</span>
              <input
                name="email"
                type="email"
                defaultValue={defaults?.email ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="contato@cliente.com"
              />
            </label>

            <label className="grid gap-2 xl:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Telefone</span>
              <input
                name="phone"
                defaultValue={formatBrazilPhone(defaults?.phone ?? "")}
                inputMode="numeric"
                maxLength={15}
                onInput={(event) => {
                  event.currentTarget.value = formatBrazilPhone(event.currentTarget.value);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="(11) 99999-9999"
              />
            </label>
          </div>
        ) : (
          <div key="personal-contact-row" className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Estado civil</span>
              <input
                name="civilStatus"
                defaultValue={defaults?.civilStatus ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="Ex.: Solteiro(a)"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">RG</span>
              <input
                name="rg"
                defaultValue={defaults?.rg ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="RG do cliente"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">E-mail</span>
              <input
                name="email"
                type="email"
                defaultValue={defaults?.email ?? ""}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="contato@cliente.com"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Telefone</span>
              <input
                name="phone"
                defaultValue={formatBrazilPhone(defaults?.phone ?? "")}
                inputMode="numeric"
                maxLength={15}
                onInput={(event) => {
                  event.currentTarget.value = formatBrazilPhone(event.currentTarget.value);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                placeholder="(11) 99999-9999"
              />
            </label>
          </div>
        )}
      </section>

      <section className="grid gap-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
        <div>
          <p className="eyebrow text-slate-400">Carteira e observações</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Distribuicao operacional
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajuste a atribuicao da carteira, guarde o endereco completo e registre
            observacoes que ajudam a equipe no atendimento.
          </p>
        </div>

        {allowResponsibleSelection ? (
          <label className="grid gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Responsável da carteira</span>
            <select
              name="responsibleUserId"
              defaultValue={defaults?.responsibleUserId ?? ""}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            >
              <option value="">Sem responsavel</option>
              {responsibleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {`${option.label} • ${option.helper}`}
                </option>
              ))}
            </select>
          </label>
        ) : responsibleSummary ? (
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            <p className="font-medium text-slate-900">Responsável da carteira</p>
            <p className="mt-2 flex items-start gap-2 leading-6">
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-blue-500" />
              <span>{responsibleSummary}</span>
            </p>
          </div>
        ) : null}

        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Endereço</span>
          <input
            name="address"
            defaultValue={defaults?.address ?? ""}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            placeholder="Rua, numero, bairro, cidade/UF"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Observações</span>
          <textarea
            name="notes"
            defaultValue={defaults?.notes ?? ""}
            rows={5}
            className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            placeholder="Informacoes relevantes sobre o cliente"
          />
        </label>

        {isEdit ? (
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaults?.isActive}
              className="size-4 rounded border-line"
            />
            Cliente ativo
          </label>
        ) : null}
      </section>

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
