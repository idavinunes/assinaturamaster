"use client";

import { useState } from "react";
import type { TemplateScope } from "@prisma/client";
import {
  nativeTemplateVariableGroups,
  templateScopeLabels,
  templateStatusLabels,
  templateStatusValues,
} from "@/lib/templates";

type TemplateFormProps = {
  actionUrl: string;
  submitLabel: string;
  pendingLabel: string;
  error?: string;
  defaults?: {
    name?: string;
    description?: string | null;
    version?: number;
    body?: string;
    variableSchemaInput?: string;
    status?: string;
    scope?: TemplateScope;
    allowedTeamIds?: string[];
    sourceFileName?: string | null;
    sourceStoragePath?: string | null;
  };
  scopeField: {
    mode: "select" | "hidden";
    value: TemplateScope;
    options?: Array<{ value: TemplateScope; label: string }>;
    helper?: string;
    lockedLabel?: string;
  };
  allowedTeamsField?: {
    mode: "hidden" | "multi-select";
    ownerTeam?: {
      id: string;
      label: string;
    } | null;
    options?: Array<{
      value: string;
      label: string;
    }>;
    helper?: string;
    lockedLabel?: string;
  };
};

export function TemplateForm({
  actionUrl,
  submitLabel,
  pendingLabel,
  error,
  defaults,
  scopeField,
  allowedTeamsField,
}: TemplateFormProps) {
  void pendingLabel;
  const [selectedSourceFileName, setSelectedSourceFileName] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<TemplateScope>(
    defaults?.scope ?? scopeField.value,
  );
  const docxIsPrimarySource =
    Boolean(defaults?.sourceStoragePath) || Boolean(selectedSourceFileName);

  return (
    <form
      action={actionUrl}
      method="post"
      encType="multipart/form-data"
      className="mt-6 grid gap-5"
    >
      <div className="grid gap-5 md:grid-cols-[1.2fr_0.4fr_0.6fr]">
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Nome do modelo</span>
          <input
            name="name"
            defaultValue={defaults?.name}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Versao</span>
          <input
            name="version"
            type="number"
            min={1}
            defaultValue={defaults?.version ?? 1}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="eyebrow text-muted">Status</span>
          <select
            name="status"
            defaultValue={defaults?.status ?? "DRAFT"}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          >
            {templateStatusValues.map((status) => (
              <option key={status} value={status}>
                {templateStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {scopeField.mode === "select" ? (
        <label className="grid gap-2">
          <span className="eyebrow text-muted">Visibilidade</span>
          <select
            name="scope"
            value={selectedScope}
            onChange={(event) => {
              setSelectedScope(event.currentTarget.value as TemplateScope);
            }}
            className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
            required
          >
            {scopeField.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {scopeField.helper ? (
            <p className="text-xs leading-5 text-muted">{scopeField.helper}</p>
          ) : null}
        </label>
      ) : (
        <>
          <input type="hidden" name="scope" value={scopeField.value} />
          <div className="rounded-[24px] border border-line bg-white/70 px-4 py-4">
            <p className="eyebrow text-muted">Visibilidade</p>
            <p className="mt-2 text-sm text-foreground">
              {scopeField.lockedLabel ?? templateScopeLabels[scopeField.value]}
            </p>
            {scopeField.helper ? (
              <p className="mt-2 text-xs leading-5 text-muted">{scopeField.helper}</p>
            ) : null}
          </div>
        </>
      )}

      {selectedScope === "TEAM_PRIVATE" && allowedTeamsField ? (
        allowedTeamsField.mode === "multi-select" ? (
          <section className="rounded-[24px] border border-line bg-white/70 px-4 py-4">
            <p className="eyebrow text-muted">Equipes autorizadas</p>
            {allowedTeamsField.ownerTeam ? (
              <>
                <input
                  type="hidden"
                  name="allowedTeamIds"
                  value={allowedTeamsField.ownerTeam.id}
                />
                <div className="mt-3 rounded-[18px] border border-line bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    Equipe dona: {allowedTeamsField.ownerTeam.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    A equipe dona sempre continua com acesso e permissao de edicao.
                  </p>
                </div>
              </>
            ) : null}

            <div className="mt-3 grid gap-3">
              {allowedTeamsField.options?.length ? (
                allowedTeamsField.options.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start gap-3 rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      name="allowedTeamIds"
                      value={option.value}
                      defaultChecked={defaults?.allowedTeamIds?.includes(option.value)}
                      className="mt-0.5 size-4 rounded border-line text-accent focus:ring-accent"
                    />
                    <span>{option.label}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted">
                  Nenhuma outra equipe disponivel para compartilhamento.
                </p>
              )}
            </div>

            {allowedTeamsField.helper ? (
              <p className="mt-3 text-xs leading-5 text-muted">{allowedTeamsField.helper}</p>
            ) : null}
          </section>
        ) : (
          <div className="rounded-[24px] border border-line bg-white/70 px-4 py-4">
            <p className="eyebrow text-muted">Equipes autorizadas</p>
            <p className="mt-2 text-sm text-foreground">{allowedTeamsField.lockedLabel}</p>
            {allowedTeamsField.helper ? (
              <p className="mt-2 text-xs leading-5 text-muted">{allowedTeamsField.helper}</p>
            ) : null}
          </div>
        )
      ) : null}

      <label className="grid gap-2">
        <span className="eyebrow text-muted">Descricao</span>
        <input
          name="description"
          defaultValue={defaults?.description ?? ""}
          className="rounded-[22px] border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-accent"
          placeholder="Resumo do uso desse modelo"
        />
      </label>

      <label className="grid gap-2">
        <span className="eyebrow text-muted">
          Arquivo DOCX para ONLYOFFICE
        </span>
        <input
          name="sourceFile"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => {
            const fileName = event.currentTarget.files?.[0]?.name?.trim() ?? "";
            setSelectedSourceFileName(fileName || null);
          }}
          className="rounded-[22px] border border-line bg-white px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-foreground hover:file:bg-stone-200 focus:border-accent"
        />
        {docxIsPrimarySource ? (
          <p className="text-xs leading-5 text-muted">
            Arquivo atual:{" "}
            <span className="font-medium text-foreground">
              {selectedSourceFileName ?? defaults?.sourceFileName}
            </span>
          </p>
        ) : (
          <p className="text-xs leading-5 text-muted">
            Opcional. Se enviar um `.docx` e salvar o modelo, esse arquivo vira a
            fonte oficial do contrato e o sistema abre o editor DOC do ONLYOFFICE
            no proximo passo.
          </p>
        )}
      </label>

      {docxIsPrimarySource ? (
        <>
          <input type="hidden" name="body" value={defaults?.body ?? ""} />
          <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-900">Modelo editado no editor DOC</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              O `.docx` passou a ser a fonte principal deste contrato. Edite o
              conteudo, a formatacao e os placeholders diretamente no ONLYOFFICE,
              por exemplo <span className="font-mono">{`{{client_legal_name}}`}</span>,{" "}
              <span className="font-mono">{`{{client_address}}`}</span> e{" "}
              <span className="font-mono">{`{{signer_name}}`}</span>.
            </p>
          </section>
        </>
      ) : (
        <label className="grid gap-2">
          <span className="eyebrow text-muted">
            Conteudo base legado sem DOCX
          </span>
          <textarea
            name="body"
            defaultValue={defaults?.body}
            rows={16}
            className="rounded-[24px] border border-line bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-accent"
            placeholder={"Use placeholders como {{client_legal_name}}, {{client_address}} e {{signer_name}}"}
          />
          <p className="text-xs leading-5 text-muted">
            Use este campo apenas se quiser manter um modelo textual sem DOCX. Ao
            enviar um `.docx`, o contrato passa a ser editado no editor DOC.
          </p>
        </label>
      )}

      <label className="grid gap-2">
        <span className="eyebrow text-muted">Variaveis do modelo</span>
        <textarea
          name="variableSchemaInput"
          defaultValue={defaults?.variableSchemaInput ?? ""}
          rows={6}
          className="rounded-[24px] border border-line bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-accent"
          placeholder={"client_legal_name|Razao social do cliente\nsigner_name|Nome do assinante\nsigner_email|Email do assinante"}
        />
        <p className="text-xs leading-5 text-muted">
          Use este campo apenas para variaveis extras. As variaveis nativas do
          sistema abaixo ja ficam disponiveis automaticamente.
        </p>
      </label>

      <section className="rounded-[28px] border border-line bg-white/70 p-5">
        <p className="eyebrow text-muted">Variaveis nativas</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {Object.entries(nativeTemplateVariableGroups).map(([group, variables]) => (
            <div key={group} className="rounded-[24px] border border-line bg-white p-4">
              <p className="text-sm font-semibold text-foreground">{group}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variables.map((variable) => (
                  <span
                    key={variable.key}
                    className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted"
                  >
                    {`{{${variable.key}}}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="button-primary"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
