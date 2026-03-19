export const templateStatusValues = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export type TemplateStatusValue = (typeof templateStatusValues)[number];

export const templateScopeValues = ["GLOBAL", "TEAM_PRIVATE"] as const;

export type TemplateScopeValue = (typeof templateScopeValues)[number];

export const templateStatusLabels: Record<TemplateStatusValue, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado",
};

export const templateScopeLabels: Record<TemplateScopeValue, string> = {
  GLOBAL: "Global",
  TEAM_PRIVATE: "Equipes selecionadas",
};

export function formatTemplateTeamAccessSummary(teamNames: string[]) {
  if (teamNames.length === 0) {
    return "Nenhuma equipe vinculada";
  }

  if (teamNames.length === 1) {
    return teamNames[0];
  }

  if (teamNames.length === 2) {
    return `${teamNames[0]} e ${teamNames[1]}`;
  }

  return `${teamNames[0]}, ${teamNames[1]} e +${teamNames.length - 2}`;
}

export type TemplateVariable = {
  group?: string;
  key: string;
  label: string;
};

export const nativeTemplateVariables: TemplateVariable[] = [
  { group: "Cliente", key: "client_type", label: "Tipo do cliente" },
  { group: "Cliente", key: "client_display_name", label: "Nome principal do cliente" },
  { group: "Cliente", key: "client_legal_name", label: "Razao social do cliente" },
  { group: "Cliente", key: "client_document_number", label: "CPF ou CNPJ do cliente" },
  { group: "Cliente", key: "client_name", label: "Nome do cliente ou responsavel" },
  { group: "Cliente", key: "client_civil_status", label: "Estado civil do cliente ou responsavel" },
  { group: "Cliente", key: "client_rg", label: "RG do cliente ou responsavel" },
  { group: "Cliente", key: "client_email", label: "E-mail do cliente" },
  { group: "Cliente", key: "client_phone", label: "Telefone do cliente" },
  { group: "Cliente", key: "client_address", label: "Endereco do cliente" },
  { group: "Cliente", key: "client_notes", label: "Observacoes do cliente" },
  { group: "Servico", key: "service_name", label: "Nome do servico executado" },
  { group: "Servico", key: "service_description", label: "Descricao do evento executado" },
  { group: "Servico", key: "service_event_description", label: "Descricao do evento executado" },
  {
    group: "Servico",
    key: "service_identification_number",
    label: "Numero de identificacao do servico executado",
  },
  { group: "Servico", key: "service_event_amount", label: "Valor numerico do evento" },
  {
    group: "Servico",
    key: "service_event_amount_formatted",
    label: "Valor formatado em reais do evento",
  },
  {
    group: "Servico",
    key: "service_prestation_percentage",
    label: "Percentual numerico da prestacao",
  },
  {
    group: "Servico",
    key: "service_prestation_percentage_formatted",
    label: "Percentual formatado da prestacao",
  },
  { group: "Servico", key: "service_amount", label: "Valor numerico da prestacao" },
  {
    group: "Servico",
    key: "service_amount_formatted",
    label: "Valor formatado em reais da prestacao",
  },
  { group: "Servico", key: "service_prestation_amount", label: "Valor numerico da prestacao" },
  {
    group: "Servico",
    key: "service_prestation_amount_formatted",
    label: "Valor formatado em reais da prestacao",
  },
  { group: "Servico", key: "service_created_at", label: "Data de cadastro do servico executado" },
  { group: "Assinante", key: "signer_name", label: "Nome do assinante" },
  { group: "Assinante", key: "signer_email", label: "E-mail do assinante" },
  { group: "Assinante", key: "signer_document", label: "Documento do assinante" },
  { group: "Assinante", key: "signer_phone", label: "Telefone do assinante" },
  { group: "Solicitacao", key: "request_title", label: "Titulo da solicitacao" },
  { group: "Solicitacao", key: "request_public_token", label: "Token publico da assinatura" },
];

const nativeTemplateVariableKeys = new Set(
  nativeTemplateVariables.map((variable) => variable.key),
);

export const nativeTemplateVariableGroups = nativeTemplateVariables.reduce<
  Record<string, TemplateVariable[]>
>((groups, variable) => {
  const group = variable.group ?? "Sistema";
  groups[group] ??= [];
  groups[group].push(variable);
  return groups;
}, {});

function normalizeVariableKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function parseTemplateVariablesInput(value: string) {
  const rows = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const customVariables: TemplateVariable[] = rows.map((row) => {
    const [rawKey, rawLabel] = row.split("|").map((part) => part.trim());
    const key = normalizeVariableKey(rawKey ?? "");

    if (!key) {
      throw new Error("Cada variavel precisa ter uma chave.");
    }

    if (!/^[a-z0-9_]+$/.test(key)) {
      throw new Error(
        "As chaves das variaveis devem usar apenas letras minusculas, numeros e underscore.",
      );
    }

    return {
      key,
      label: rawLabel || key,
    };
  });

  const combinedVariables: TemplateVariable[] = [
    ...nativeTemplateVariables.map(({ key, label }) => ({ key, label })),
    ...customVariables,
  ];
  const uniqueKeys = new Set(combinedVariables.map((variable) => variable.key));

  if (uniqueKeys.size !== combinedVariables.length) {
    throw new Error("Nao repita variaveis personalizadas nem use chaves nativas do sistema.");
  }

  return JSON.stringify(combinedVariables);
}

export function stringifyTemplateVariables(value?: string | null) {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value) as TemplateVariable[];

    if (!Array.isArray(parsed)) {
      return "";
    }

    return parsed
      .filter((variable) => !nativeTemplateVariableKeys.has(variable.key))
      .map((variable) =>
        variable.label && variable.label !== variable.key
          ? `${variable.key}|${variable.label}`
          : variable.key,
      )
      .join("\n");
  } catch {
    return "";
  }
}

export function countTemplateVariables(value?: string | null) {
  if (!value) {
    return 0;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function parseStoredTemplateVariables(value?: string | null) {
  const nativeVariablesByKey = new Map(
    nativeTemplateVariables.map((variable) => [variable.key, variable] as const),
  );

  if (!value) {
    return nativeTemplateVariables;
  }

  try {
    const parsed = JSON.parse(value) as TemplateVariable[];

    if (!Array.isArray(parsed)) {
      return nativeTemplateVariables;
    }

    const customVariables = parsed.filter(
      (variable) =>
        variable &&
        typeof variable.key === "string" &&
        variable.key.trim().length > 0 &&
        typeof variable.label === "string" &&
        !nativeTemplateVariableKeys.has(variable.key),
    );

    return [...nativeVariablesByKey.values(), ...customVariables];
  } catch {
    return nativeTemplateVariables;
  }
}

export function buildTemplateEditorVariableGroups(value?: string | null) {
  const grouped: Record<string, TemplateVariable[]> = {};

  for (const variable of parseStoredTemplateVariables(value)) {
    const group = variable.group ?? (nativeTemplateVariableKeys.has(variable.key) ? "Sistema" : "Extras do modelo");
    grouped[group] ??= [];
    grouped[group].push(variable);
  }

  return Object.entries(grouped).map(([group, variables]) => ({
    group,
    variables,
  }));
}
