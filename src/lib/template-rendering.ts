import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";
import PizZip from "pizzip";
import { clientTypeLabels, getClientDisplayName } from "@/lib/clients";
import {
  formatBrazilPhone,
  formatCpfOrCnpj,
  formatCurrencyBRL,
  formatPercentageBR,
} from "@/lib/formatters/br";
import { readTemplateSourceFile } from "@/lib/storage/template-sources";

type SignatureTemplateInput = {
  title: string;
  publicToken: string;
  signerName: string;
  signerEmail: string;
  signerDocument?: string | null;
  signerPhone?: string | null;
  client: {
    clientType: "PERSONAL" | "BUSINESS";
    legalName?: string | null;
    documentNumber?: string | null;
    contactName?: string | null;
    civilStatus?: string | null;
    rg?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
  };
  service?: {
    identificationNumber?: string | null;
    description?: string | null;
    eventAmount: string;
    servicePercentage: string;
    amount: string;
    createdAt: Date;
    serviceCatalog: {
      name: string;
    };
  } | null;
};

type TemplateDocumentInput = {
  body: string;
  sourceStoragePath?: string | null;
  sourceFileName?: string | null;
};

export type RenderedTemplateDocument = {
  mode: "DOCX" | "LEGACY";
  html: string;
  plainText: string;
  fileBytes?: Uint8Array;
  sourceFileName?: string | null;
  renderWarning?: string;
};

function formatDatePtBr(value?: Date | null) {
  if (!value) {
    return "";
  }

  return value.toLocaleDateString("pt-BR");
}

function formatDocument(value?: string | null) {
  if (!value) {
    return "";
  }

  return formatCpfOrCnpj(value);
}

function formatPhone(value?: string | null) {
  if (!value) {
    return "";
  }

  return formatBrazilPhone(value);
}

function normalizePlainText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\u0007/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPlainTextPreviewHtml(value: string) {
  const normalized = normalizePlainText(value);

  if (!normalized) {
    return "<p>Conteudo indisponivel.</p>";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

async function renderDocxTemplateBuffer(params: {
  fileBytes: Uint8Array;
  values: Record<string, string>;
}) {
  const zip = new PizZip(Buffer.from(params.fileBytes));
  const template = new Docxtemplater(zip, {
    delimiters: {
      start: "{{",
      end: "}}",
    },
    linebreaks: true,
    paragraphLoop: true,
    nullGetter() {
      return "";
    },
  });

  try {
    template.render(params.values);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Nao foi possivel renderizar o template DOCX: ${error.message}`
        : "Nao foi possivel renderizar o template DOCX.",
    );
  }

  const renderedBuffer = template.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const [htmlResult, rawTextResult] = await Promise.all([
    mammoth.convertToHtml({ buffer: renderedBuffer }),
    mammoth.extractRawText({ buffer: renderedBuffer }),
  ]);

  const plainText = normalizePlainText(rawTextResult.value);

  return {
    fileBytes: new Uint8Array(renderedBuffer),
    html: htmlResult.value.trim() || buildPlainTextPreviewHtml(plainText),
    plainText,
  };
}

export function buildSignatureRequestTemplateValues(input: SignatureTemplateInput) {
  return {
    client_type: clientTypeLabels[input.client.clientType],
    client_display_name: getClientDisplayName(input.client),
    client_legal_name: input.client.legalName ?? "",
    client_document_number: formatDocument(input.client.documentNumber),
    client_name:
      input.client.clientType === "BUSINESS"
        ? input.client.contactName ?? input.client.legalName ?? ""
        : input.client.contactName ?? input.client.legalName ?? "",
    client_civil_status: input.client.civilStatus ?? "",
    client_rg: input.client.rg ?? "",
    client_email: input.client.email ?? "",
    client_phone: formatPhone(input.client.phone),
    client_address: input.client.address ?? "",
    client_notes: input.client.notes ?? "",
    service_name: input.service?.serviceCatalog.name ?? "",
    service_description: input.service?.description ?? "",
    service_event_description: input.service?.description ?? "",
    service_identification_number: input.service?.identificationNumber ?? "",
    service_event_amount: input.service?.eventAmount ?? "",
    service_event_amount_formatted: input.service
      ? formatCurrencyBRL(input.service.eventAmount)
      : "",
    service_prestation_percentage: input.service?.servicePercentage ?? "",
    service_prestation_percentage_formatted: input.service
      ? formatPercentageBR(input.service.servicePercentage)
      : "",
    service_amount: input.service?.amount ?? "",
    service_amount_formatted: input.service ? formatCurrencyBRL(input.service.amount) : "",
    service_prestation_amount: input.service?.amount ?? "",
    service_prestation_amount_formatted: input.service
      ? formatCurrencyBRL(input.service.amount)
      : "",
    service_created_at: formatDatePtBr(input.service?.createdAt),
    signer_name: input.signerName,
    signer_email: input.signerEmail,
    signer_document: formatDocument(input.signerDocument),
    signer_phone: formatPhone(input.signerPhone),
    request_title: input.title,
    request_public_token: input.publicToken,
  };
}

export function renderContractTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key in values) {
      return values[key] ?? "";
    }

    return match;
  });
}

export async function extractTemplateBodyFromSource(fileBytes: Uint8Array) {
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(fileBytes),
  });
  const plainText = normalizePlainText(value);

  return plainText || "Modelo DOCX vinculado ao ONLYOFFICE.";
}

export async function renderTemplateDocument(params: {
  template: TemplateDocumentInput;
  values: Record<string, string>;
}): Promise<RenderedTemplateDocument> {
  if (params.template.sourceStoragePath) {
    try {
      const sourceFile = await readTemplateSourceFile(params.template.sourceStoragePath);
      const renderedSource = await renderDocxTemplateBuffer({
        fileBytes: new Uint8Array(sourceFile),
        values: params.values,
      });

      return {
        mode: "DOCX",
        html: renderedSource.html,
        plainText: renderedSource.plainText || renderContractTemplate(params.template.body, params.values),
        fileBytes: renderedSource.fileBytes,
        sourceFileName: params.template.sourceFileName ?? null,
      };
    } catch (error) {
      const fallbackText = renderContractTemplate(params.template.body, params.values);

      return {
        mode: "LEGACY",
        html: buildPlainTextPreviewHtml(fallbackText),
        plainText: fallbackText,
        sourceFileName: params.template.sourceFileName ?? null,
        renderWarning:
          error instanceof Error
            ? error.message
            : "Nao foi possivel usar o DOCX do modelo. O sistema exibiu o fallback legado.",
      };
    }
  }

  const fallbackText = renderContractTemplate(params.template.body, params.values);

  return {
    mode: "LEGACY",
    html: buildPlainTextPreviewHtml(fallbackText),
    plainText: fallbackText,
  };
}
