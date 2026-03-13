import { z } from "zod";
import { clientDocumentTypeValues } from "@/lib/client-documents";
import { clientTypeValues } from "@/lib/clients";
import {
  formatCurrencyBRL,
  isValidBrazilPhone,
  isValidCnpj,
  isValidCpf,
  isValidCpfOrCnpj,
  normalizeCurrencyToDecimalString,
  normalizePercentageToDecimalString,
  onlyDigits,
} from "@/lib/formatters/br";
import { templateScopeValues, templateStatusValues } from "@/lib/templates";
import { manageableSignatureRequestStatusValues } from "@/lib/signature-requests";

export const roleValues = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATOR",
  "VIEWER",
] as const;

export const teamMemberRoleValues = [
  "ADMIN",
  "MANAGER",
  "OPERATOR",
  "VIEWER",
] as const;

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
});

export const createUserSchema = z.object({
  name: z.string().min(3, "Informe um nome com pelo menos 3 caracteres."),
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(8, "A senha inicial precisa ter ao menos 8 caracteres."),
  role: z.enum(roleValues),
  initialTeamId: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^[a-z0-9]{25}$/i.test(value),
      "Selecione uma equipe valida.",
    )
    .transform((value) => value || undefined)
    .optional(),
  initialTeamRole: z.enum(teamMemberRoleValues).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(3, "Informe um nome com pelo menos 3 caracteres."),
  email: z.string().email("Informe um e-mail valido."),
  password: z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => value.length === 0 || value.length >= 8,
      "A nova senha precisa ter ao menos 8 caracteres.",
    ),
  role: z.enum(roleValues),
  isActive: z.boolean(),
});

const baseTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe um nome com pelo menos 3 caracteres.")
    .max(120, "Use no maximo 120 caracteres no nome da equipe."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe um identificador com pelo menos 3 caracteres.")
    .max(60, "Use no maximo 60 caracteres no identificador.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use apenas letras minusculas, numeros e hifens no identificador.",
    ),
  description: z
    .string()
    .trim()
    .max(2000, "Use no maximo 2000 caracteres na descricao.")
    .optional(),
});

export const createTeamSchema = baseTeamSchema;

export const updateTeamSchema = baseTeamSchema.extend({
  isActive: z.boolean(),
});

export const upsertTeamMembershipSchema = z.object({
  userId: z.string().cuid("Selecione um usuario valido."),
  role: z.enum(teamMemberRoleValues),
});

export const upsertUserMembershipSchema = z.object({
  teamId: z.string().cuid("Selecione uma equipe valida."),
  role: z.enum(teamMemberRoleValues),
});

export const updateTeamMembershipSchema = z.object({
  role: z.enum(teamMemberRoleValues),
  isActive: z.boolean(),
});

export const brandingSettingsSchema = z.object({
  productName: z.string().trim().min(2, "Informe o nome do produto."),
  productShortName: z
    .string()
    .trim()
    .min(2, "Informe o nome curto do produto.")
    .max(40, "Use no maximo 40 caracteres no nome curto."),
  productTagline: z
    .string()
    .trim()
    .min(2, "Informe um subtitulo para a marca.")
    .max(120, "Use no maximo 120 caracteres no subtitulo."),
  logoPath: z
    .string()
    .trim()
    .min(1, "Informe o caminho ou URL da logo.")
    .max(500, "Use no maximo 500 caracteres no caminho da logo.")
    .refine(
      (value) => value.startsWith("/") || /^https?:\/\//.test(value),
      "Use um caminho comecando com / ou URL http(s).",
    ),
  browserTitle: z
    .string()
    .trim()
    .min(2, "Informe o titulo do navegador.")
    .max(120, "Use no maximo 120 caracteres no titulo do navegador."),
  browserDescription: z
    .string()
    .trim()
    .min(10, "Informe uma descricao mais completa para o navegador.")
    .max(300, "Use no maximo 300 caracteres na descricao do navegador."),
});

export const teamBrandingSettingsSchema = z.object({
  productName: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      "Informe o nome do produto ou deixe em branco para usar o global.",
    ),
  productShortName: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      "Informe o nome curto ou deixe em branco para usar o global.",
    )
    .refine(
      (value) => value.length === 0 || value.length <= 40,
      "Use no maximo 40 caracteres no nome curto.",
    ),
  productTagline: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      "Informe um subtitulo ou deixe em branco para usar o global.",
    )
    .refine(
      (value) => value.length === 0 || value.length <= 120,
      "Use no maximo 120 caracteres no subtitulo.",
    ),
  logoPath: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 || value.startsWith("/") || /^https?:\/\//.test(value),
      "Use um caminho comecando com /, uma URL http(s) ou deixe em branco.",
    )
    .refine(
      (value) => value.length <= 500,
      "Use no maximo 500 caracteres no caminho da logo.",
    ),
  browserTitle: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      "Informe o titulo do navegador ou deixe em branco para usar o global.",
    )
    .refine(
      (value) => value.length === 0 || value.length <= 120,
      "Use no maximo 120 caracteres no titulo do navegador.",
    ),
  browserDescription: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || value.length >= 10,
      "Informe uma descricao mais completa ou deixe em branco para usar o global.",
    )
    .refine(
      (value) => value.length === 0 || value.length <= 300,
      "Use no maximo 300 caracteres na descricao do navegador.",
    ),
});

const baseClientSchema = z.object({
  clientType: z.enum(clientTypeValues),
  legalName: z.string().trim().optional(),
  documentNumber: z.string().transform((value) => onlyDigits(value)),
  responsibleUserId: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^[a-z0-9]{25}$/i.test(value),
      "Selecione um responsavel valido.",
    )
    .transform((value) => value || undefined)
    .optional(),
  contactName: z.string().trim().optional(),
  civilStatus: z
    .string()
    .trim()
    .max(80, "Informe um estado civil com no maximo 80 caracteres.")
    .optional(),
  rg: z
    .string()
    .trim()
    .max(30, "Informe um RG com no maximo 30 caracteres.")
    .optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .transform((value) => onlyDigits(value))
    .refine(
      (value) => value.length === 0 || isValidBrazilPhone(value),
      "Informe um telefone valido com DDD.",
    )
    .optional(),
  address: z.string().min(8, "Informe um endereco mais completo.").optional(),
  notes: z.string().max(2000).optional(),
});

export const createClientSchema = baseClientSchema.superRefine((data, ctx) => {
  if (data.clientType === "PERSONAL") {
    if (!data.contactName || data.contactName.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o nome completo da pessoa.",
        path: ["contactName"],
      });
    }

    if (!isValidCpf(data.documentNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe um CPF valido.",
        path: ["documentNumber"],
      });
    }

    return;
  }

  if (!data.legalName || data.legalName.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe a razao social da empresa.",
      path: ["legalName"],
    });
  }

  if (!isValidCnpj(data.documentNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe um CNPJ valido.",
      path: ["documentNumber"],
    });
  }
});

export const updateClientSchema = createClientSchema.extend({
  isActive: z.boolean(),
});

export const uploadClientDocumentSchema = z.object({
  documentType: z.enum(clientDocumentTypeValues),
  description: z
    .string()
    .trim()
    .max(300, "Use no maximo 300 caracteres na descricao.")
    .optional(),
});

export const createServiceCatalogSchema = z.object({
  name: z.string().min(3, "Informe o nome do servico."),
  description: z.string().max(3000).optional(),
  eventAmount: z
    .string()
    .trim()
    .refine((value) => value.length > 0, "Informe o valor do evento.")
    .transform((value) => normalizeCurrencyToDecimalString(value))
    .refine((value) => value.length > 0, "Informe o valor do evento.")
    .refine((value) => Number(value) > 0, `Use um valor acima de ${formatCurrencyBRL(0.01)}.`),
  defaultPercentage: z
    .string()
    .trim()
    .refine((value) => value.length > 0, "Informe o percentual de prestacao.")
    .transform((value) => normalizePercentageToDecimalString(value))
    .refine((value) => value.length > 0, "Informe o percentual de prestacao.")
    .refine((value) => Number(value) > 0, "Use um percentual acima de 0%.")
    .refine((value) => Number(value) <= 100, "Use um percentual de no maximo 100%."),
  scope: z.enum(["GLOBAL", "TEAM_PRIVATE"]),
});

export const updateServiceCatalogSchema = createServiceCatalogSchema.extend({
  isActive: z.boolean(),
});

export const createExecutedServiceSchema = z.object({
  clientId: z.string().cuid("Selecione um cliente valido."),
  serviceCatalogId: z.string().cuid("Selecione um servico valido."),
  identificationNumber: z
    .string()
    .trim()
    .max(120, "Use no maximo 120 caracteres na identificacao.")
    .optional(),
  description: z.string().max(3000).optional(),
  eventAmount: z
    .string()
    .trim()
    .refine((value) => value.length > 0, "Informe o valor do evento.")
    .transform((value) => normalizeCurrencyToDecimalString(value))
    .refine((value) => value.length > 0, "Informe o valor do evento.")
    .refine((value) => Number(value) > 0, `Use um valor acima de ${formatCurrencyBRL(0.01)}.`),
  servicePercentage: z
    .string()
    .trim()
    .refine((value) => value.length > 0, "Informe o percentual de prestacao.")
    .transform((value) => normalizePercentageToDecimalString(value))
    .refine((value) => value.length > 0, "Informe o percentual de prestacao.")
    .refine((value) => Number(value) > 0, "Use um percentual acima de 0%.")
    .refine((value) => Number(value) <= 100, "Use um percentual de no maximo 100%."),
});

export const updateExecutedServiceSchema = createExecutedServiceSchema;

export const createTemplateSchema = z.object({
  name: z.string().min(3, "Informe um nome para o modelo."),
  description: z.string().max(2000).optional(),
  version: z.coerce.number().int().min(1, "A versao precisa ser maior que zero."),
  body: z.string().trim().optional(),
  variableSchemaInput: z.string().optional(),
  status: z.enum(templateStatusValues),
  scope: z.enum(templateScopeValues),
});

export const updateTemplateSchema = createTemplateSchema.extend({
  version: z.coerce.number().int().min(1, "A versao precisa ser maior que zero."),
});

const baseSignatureRequestSchema = z.object({
  title: z.string().min(3, "Informe um titulo para a solicitacao."),
  clientId: z.string().cuid("Selecione um cliente valido."),
  serviceId: z.string().cuid("Selecione um servico executado valido."),
  templateId: z.string().cuid("Selecione um modelo valido."),
  signerName: z.string().min(3, "Informe o nome do assinante."),
  signerEmail: z.string().email("Informe um e-mail valido."),
  signerDocument: z
    .string()
    .trim()
    .transform((value) => onlyDigits(value))
    .refine(
      (value) => value.length === 0 || isValidCpfOrCnpj(value),
      "Informe um CPF ou CNPJ valido para o assinante.",
    )
    .optional(),
  signerPhone: z
    .string()
    .trim()
    .transform((value) => onlyDigits(value))
    .refine(
      (value) => value.length === 0 || isValidBrazilPhone(value),
      "Informe um telefone valido com DDD para o assinante.",
    )
    .optional(),
  status: z.enum(manageableSignatureRequestStatusValues),
  expiresAt: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Informe uma data de expiracao valida.",
    )
    .optional(),
});

export const createSignatureRequestSchema = baseSignatureRequestSchema;

export const updateSignatureRequestSchema = createSignatureRequestSchema;

export const signatureEvidenceSchema = z.object({
  ipAddress: z.string().min(3),
  userAgent: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().min(0).optional(),
  locationAddress: z.string().trim().min(5).max(1000).optional(),
  selfieBase64: z.string().optional(),
  termsAccepted: z.boolean(),
  termsVersion: z.string().min(1),
  signedAtBrowser: z.string().datetime(),
});

export const publicSignatureEvidenceCaptureSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().min(0).optional(),
  locationAddress: z.string().trim().min(5).max(1000).optional(),
  selfieBase64: z.string().trim().min(30).max(8_000_000).optional(),
  selfieCapturedAt: z.string().datetime().optional(),
});

export const publicSignatureFinalizeSchema = z.object({
  signatureBase64: z.string().trim().min(30).max(8_000_000),
  signedAtBrowser: z.string().datetime(),
  termsAccepted: z.literal(true),
  termsVersion: z.string().trim().min(1).max(100),
});
