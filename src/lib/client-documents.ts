export const clientDocumentTypeValues = [
  "PRIMARY_DOCUMENT",
  "RG",
  "ADDRESS_PROOF",
  "OTHER",
] as const;

export type ClientDocumentTypeValue = (typeof clientDocumentTypeValues)[number];

export const clientDocumentTypeLabels: Record<ClientDocumentTypeValue, string> = {
  PRIMARY_DOCUMENT: "CPF/CNPJ",
  RG: "RG",
  ADDRESS_PROOF: "Comprovante de endereco",
  OTHER: "Outro documento",
};

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}
