export const clientTypeValues = ["PERSONAL", "BUSINESS"] as const;

export type ClientTypeValue = (typeof clientTypeValues)[number];

export const clientTypeLabels: Record<ClientTypeValue, string> = {
  PERSONAL: "Pessoal",
  BUSINESS: "Empresarial",
};

export function getClientDisplayName(input: {
  clientType: ClientTypeValue;
  legalName?: string | null;
  contactName?: string | null;
}) {
  if (input.clientType === "BUSINESS") {
    return input.legalName ?? input.contactName ?? "Sem nome";
  }

  return input.contactName ?? input.legalName ?? "Sem nome";
}
