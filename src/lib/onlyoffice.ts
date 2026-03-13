import { jwtVerify, SignJWT } from "jose";

type OnlyOfficeRoutePurpose = "source" | "callback" | "signature-rendered-docx";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  );
}

function getTextSecret(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} nao configurado.`);
  }

  return new TextEncoder().encode(value);
}

export function getAppUrl() {
  const value = process.env.APP_URL;

  if (!value) {
    throw new Error("APP_URL nao configurado.");
  }

  return normalizeBaseUrl(value);
}

export function getOnlyOfficeUrl() {
  const value = process.env.ONLYOFFICE_URL;

  if (!value) {
    throw new Error("ONLYOFFICE_URL nao configurado.");
  }

  return normalizeBaseUrl(value);
}

export function getOnlyOfficeEditorEnvironmentIssue() {
  const appUrl = getAppUrl();
  const onlyOfficeUrl = getOnlyOfficeUrl();
  const appHost = new URL(appUrl).hostname;
  const onlyOfficeHost = new URL(onlyOfficeUrl).hostname;

  if (isLoopbackHostname(appHost) && !isLoopbackHostname(onlyOfficeHost)) {
    return {
      appUrl,
      onlyOfficeUrl,
      message:
        "O ONLYOFFICE nao consegue baixar nem salvar o DOCX porque a aplicacao ainda esta exposta como localhost.",
    };
  }

  return null;
}

export async function signOnlyOfficeEditorConfig(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(getTextSecret("ONLYOFFICE_JWT_SECRET"));
}

export async function createOnlyOfficeRouteToken(params: {
  resourceId: string;
  purpose: OnlyOfficeRoutePurpose;
}) {
  return new SignJWT({
    purpose: params.purpose,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.resourceId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getTextSecret("AUTH_SECRET"));
}

export async function verifyOnlyOfficeRouteToken(token: string, purpose: OnlyOfficeRoutePurpose) {
  const { payload } = await jwtVerify(token, getTextSecret("AUTH_SECRET"));

  if (!payload.sub || payload.purpose !== purpose) {
    throw new Error("Token do ONLYOFFICE invalido.");
  }

  return {
    resourceId: payload.sub,
  };
}

export function buildOnlyOfficeDocumentKey(params: {
  templateId: string;
  updatedAt: Date;
}) {
  return `${params.templateId}-${params.updatedAt.getTime()}`;
}

export async function buildOnlyOfficeTemplateEditorConfig(params: {
  templateId: string;
  templateName: string;
  sourceFileName?: string | null;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
  };
}) {
  const appUrl = getAppUrl();
  const sourceToken = await createOnlyOfficeRouteToken({
    resourceId: params.templateId,
    purpose: "source",
  });
  const callbackToken = await createOnlyOfficeRouteToken({
    resourceId: params.templateId,
    purpose: "callback",
  });

  const config = {
    documentType: "word",
    type: "desktop",
    width: "100%",
    height: "100%",
    document: {
      fileType: "docx",
      key: buildOnlyOfficeDocumentKey({
        templateId: params.templateId,
        updatedAt: params.updatedAt,
      }),
      title: params.sourceFileName ?? `${params.templateName}.docx`,
      url: `${appUrl}/api/onlyoffice/templates/${params.templateId}/source?token=${sourceToken}`,
      permissions: {
        chat: false,
        comment: true,
        copy: true,
        download: true,
        edit: true,
        fillForms: true,
        modifyContentControl: true,
        modifyFilter: false,
        print: true,
        review: true,
      },
    },
    editorConfig: {
      mode: "edit",
      lang: "pt-BR",
      callbackUrl: `${appUrl}/api/onlyoffice/templates/${params.templateId}/callback?token=${callbackToken}`,
      user: {
        id: params.user.id,
        name: params.user.name,
      },
      customization: {
        autosave: true,
        compactHeader: true,
        compactToolbar: true,
        forcesave: true,
      },
    },
  } satisfies Record<string, unknown>;

  return {
    config,
    token: await signOnlyOfficeEditorConfig(config),
  };
}

export async function buildOnlyOfficeSignatureRenderedDocxUrl(signatureRequestId: string) {
  const appUrl = getAppUrl();
  const routeToken = await createOnlyOfficeRouteToken({
    resourceId: signatureRequestId,
    purpose: "signature-rendered-docx",
  });

  return `${appUrl}/api/onlyoffice/signature-requests/${signatureRequestId}/rendered-docx?token=${routeToken}`;
}
