export const signatureRequestStatusValues = [
  "DRAFT",
  "SENT",
  "OPENED",
  "SIGNED",
  "EXPIRED",
  "CANCELED",
] as const;

export type SignatureRequestStatusValue = (typeof signatureRequestStatusValues)[number];

export const signatureRequestStatusLabels: Record<SignatureRequestStatusValue, string> = {
  DRAFT: "Rascunho",
  SENT: "Enviado",
  OPENED: "Aberto",
  SIGNED: "Assinado",
  EXPIRED: "Expirado",
  CANCELED: "Cancelado",
};

export const manageableSignatureRequestStatusValues = [
  "DRAFT",
  "SENT",
  "CANCELED",
] as const;

export function buildPublicSignaturePath(publicToken: string) {
  return `/assinar/${publicToken}`;
}

export function buildPublicSignatureSelfiePath(publicToken: string) {
  return `/api/public-signature/${publicToken}/selfie`;
}

export function buildPublicSignatureDrawnSignaturePath(publicToken: string) {
  return `/api/public-signature/${publicToken}/signature-mark`;
}

export function buildAdminSignedDocumentPath(signatureRequestId: string) {
  return `/api/admin/signature-requests/${signatureRequestId}/signed-document`;
}

export function formatPublicSignatureUrl(publicToken: string, baseUrl?: string) {
  const path = buildPublicSignaturePath(publicToken);

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}
