"use client";

import { useActionState } from "react";
import type { BrandingSettingsFormState } from "@/app/painel/configuracoes/actions";
import type {
  BrandingSettingsValues,
  TeamBrandingSettingsValues,
} from "@/lib/branding";
import { SubmitButton } from "@/components/submit-button";

type BrandingSettingsFormProps = {
  action: (
    state: BrandingSettingsFormState,
    formData: FormData,
  ) => Promise<BrandingSettingsFormState>;
  defaults: BrandingSettingsValues | TeamBrandingSettingsValues;
  fallbackValues?: BrandingSettingsValues;
  allowBlankValues?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
};

const initialState: BrandingSettingsFormState = {};

function getFieldValue(
  value: string | null | undefined,
  allowBlankValues: boolean,
) {
  if (allowBlankValues) {
    return value ?? "";
  }

  return value ?? "";
}

export function BrandingSettingsForm({
  action,
  defaults,
  fallbackValues,
  allowBlankValues = false,
  submitLabel = "Salvar configuracoes",
  pendingLabel = "Salvando...",
}: BrandingSettingsFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      {allowBlankValues ? (
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
          Deixe qualquer campo em branco para herdar o valor da configuracao global.
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Nome do produto</span>
          <input
            name="productName"
            defaultValue={getFieldValue(defaults.productName, allowBlankValues)}
            placeholder={allowBlankValues ? fallbackValues?.productName : undefined}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            required={!allowBlankValues}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Nome curto</span>
          <input
            name="productShortName"
            defaultValue={getFieldValue(defaults.productShortName, allowBlankValues)}
            placeholder={allowBlankValues ? fallbackValues?.productShortName : undefined}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            required={!allowBlankValues}
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Subtítulo da marca</span>
          <input
            name="productTagline"
            defaultValue={getFieldValue(defaults.productTagline, allowBlankValues)}
            placeholder={allowBlankValues ? fallbackValues?.productTagline : undefined}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            required={!allowBlankValues}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Logo (caminho ou URL)</span>
          <input
            name="logoPath"
            defaultValue={getFieldValue(defaults.logoPath, allowBlankValues)}
            placeholder={
              allowBlankValues
                ? fallbackValues?.logoPath
                : "/brand-logo.svg"
            }
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            required={!allowBlankValues}
          />
          <p className="text-xs leading-5 text-slate-500">
            Use um arquivo em `public`, como `/brand-logo.svg`, ou uma URL externa.
          </p>
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Título do navegador</span>
          <input
            name="browserTitle"
            defaultValue={getFieldValue(defaults.browserTitle, allowBlankValues)}
            placeholder={allowBlankValues ? fallbackValues?.browserTitle : undefined}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            required={!allowBlankValues}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Descrição do navegador</span>
          <textarea
            name="browserDescription"
            defaultValue={getFieldValue(defaults.browserDescription, allowBlankValues)}
            placeholder={allowBlankValues ? fallbackValues?.browserDescription : undefined}
            rows={4}
            className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            required={!allowBlankValues}
          />
        </label>
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
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
