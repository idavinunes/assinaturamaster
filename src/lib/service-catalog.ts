import { ServiceCatalogScope } from "@prisma/client";

export const serviceCatalogScopeValues = [
  ServiceCatalogScope.GLOBAL,
  ServiceCatalogScope.TEAM_PRIVATE,
] as const;

export const serviceCatalogScopeLabels: Record<ServiceCatalogScope, string> = {
  GLOBAL: "Global",
  TEAM_PRIVATE: "Da equipe",
};
