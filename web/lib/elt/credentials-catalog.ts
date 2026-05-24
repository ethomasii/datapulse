/**
 * Thin adapter that re-exports credential/config data from connectors-registry.ts
 * using the same function signatures all consumers already import.
 *
 * Do not add connector data here — edit connectors-registry.ts instead.
 */

import {
  ALL_CONNECTORS,
  getConnectorSourceCredentials,
  getConnectorDestinationCredentials,
  getConnectorSourceConfigFields,
  type CredentialField,
  type ConfigField,
} from "./connectors-registry";

// Re-export types under legacy names so existing imports keep compiling.
export type CatalogFieldOption = { value: string; label: string };
export type CatalogCredentialField = CredentialField;
export type CatalogSourceConfigField = ConfigField;

export function getSourceCredentials(sourceType: string): CatalogCredentialField[] {
  return getConnectorSourceCredentials(sourceType.toLowerCase());
}

export function getDestinationCredentials(destinationType: string): CatalogCredentialField[] {
  return getConnectorDestinationCredentials(destinationType.toLowerCase());
}

export function getSourceConfigurationFields(sourceType: string): CatalogSourceConfigField[] {
  return getConnectorSourceConfigFields(sourceType.toLowerCase());
}

export const ALL_CREDENTIAL_ENV_KEYS: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const connector of ALL_CONNECTORS) {
    for (const f of connector.credentialFields ?? []) s.add(f.key);
  }
  return s;
})();

export function stripCredentialKeysFromConfig(cfg: Record<string, unknown>): Record<string, unknown> {
  const next = { ...cfg };
  for (const k of Array.from(ALL_CREDENTIAL_ENV_KEYS)) {
    delete next[k];
  }
  return next;
}
