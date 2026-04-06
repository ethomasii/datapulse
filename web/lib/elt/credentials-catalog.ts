import catalog from "./credentials-catalog.json";

/** Field from embedded_elt_builder `credentials_config.py` (serialized). */
export type CatalogFieldOption = { value: string; label: string };

export type CatalogCredentialField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: CatalogFieldOption[];
  default?: string | boolean;
  show_if?: Record<string, unknown>;
};

export type CatalogSourceConfigField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: CatalogFieldOption[];
  default?: string | boolean | string[];
  show_if?: Record<string, unknown>;
};

export type CredentialsCatalogFile = {
  sourceCredentials: Record<string, CatalogCredentialField[]>;
  destinationCredentials: Record<string, CatalogCredentialField[]>;
  sourceConfigurations: Record<string, CatalogSourceConfigField[]>;
};

export const credentialsCatalog = catalog as CredentialsCatalogFile;

export function getSourceConfigurationFields(sourceType: string): CatalogSourceConfigField[] {
  return credentialsCatalog.sourceConfigurations[sourceType.toLowerCase()] ?? [];
}

export function getSourceCredentials(sourceType: string): CatalogCredentialField[] {
  return credentialsCatalog.sourceCredentials[sourceType.toLowerCase()] ?? [];
}

export function getDestinationCredentials(destinationType: string): CatalogCredentialField[] {
  return credentialsCatalog.destinationCredentials[destinationType.toLowerCase()] ?? [];
}

/** Every env-style key defined for sources and destinations — strip from persisted sourceConfiguration. */
export const ALL_CREDENTIAL_ENV_KEYS: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const fields of Object.values(credentialsCatalog.sourceCredentials)) {
    for (const f of fields) s.add(f.key);
  }
  for (const fields of Object.values(credentialsCatalog.destinationCredentials)) {
    for (const f of fields) s.add(f.key);
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
