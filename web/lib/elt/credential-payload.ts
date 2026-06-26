import {
  getDestinationCredentials,
  getSourceCredentials,
} from "./credentials-catalog";
import { ALL_CONNECTORS } from "./connectors-registry";

/** Env keys we never persist (passwords, pasted JSON blobs, private keys). */
export const CREDENTIAL_SENSITIVE_KEY_SET: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const connector of ALL_CONNECTORS) {
    for (const f of connector.credentialFields ?? []) {
      if (f.type === "password" || f.type === "textarea") {
        s.add(f.key);
      }
    }
  }
  return s;
})();

/** Catalog-defined credential env keys for this connector side (used for encrypted `secrets` allowlists). */
export function credentialKeysForConnectionSide(
  connectionType: "source" | "destination",
  connector: string
): ReadonlySet<string> {
  const c = connector.toLowerCase();
  const fields =
    connectionType === "destination" ? getDestinationCredentials(c) : getSourceCredentials(c);
  return new Set(fields.map((f) => f.key));
}

/** Pull catalog credential keys out of `sourceConfiguration` for dedicated form state. */
export function extractConnectionValues(
  cfg: Record<string, unknown>,
  sourceType: string,
  destinationType: string
): { core: Record<string, unknown>; connection: Record<string, string> } {
  const core = { ...cfg };
  const connection: Record<string, string> = {};
  const keys = new Set<string>();
  for (const f of getSourceCredentials(sourceType)) {
    keys.add(f.key);
  }
  for (const f of getDestinationCredentials(destinationType)) {
    keys.add(f.key);
  }
  for (const k of Array.from(keys)) {
    const v = core[k];
    if (v !== undefined && v !== null) {
      connection[k] = String(v);
      delete core[k];
    }
  }
  return { core, connection };
}

export function emptyConnectionValuesForTypes(
  sourceType: string,
  destinationType: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of getSourceCredentials(sourceType)) {
    out[f.key] = "";
  }
  for (const f of getDestinationCredentials(destinationType)) {
    out[f.key] = "";
  }
  return out;
}

/** Merge connection form strings into config; omit empty strings. */
export function mergeConnectionStrings(
  core: Record<string, unknown>,
  connection: Record<string, string>
): Record<string, unknown> {
  const next = { ...core };
  for (const [k, v] of Object.entries(connection)) {
    if (v.trim() !== "") {
      next[k] = v;
    } else {
      delete next[k];
    }
  }
  return next;
}

export function sanitizeCredentialsForPersistence(cfg: Record<string, unknown>): Record<string, unknown> {
  const next = { ...cfg };
  for (const k of Array.from(CREDENTIAL_SENSITIVE_KEY_SET)) {
    delete next[k];
  }
  return next;
}

/** Map saved connection `config` into catalog credential form keys (non-secrets only). */
export function connectionConfigToFormValues(
  connector: string,
  config: Record<string, string>
): Record<string, string> {
  const slug = connector.toLowerCase().trim();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (v.trim()) out[k] = v.trim();
  }
  if (slug === "motherduck") {
    const db = out.database ?? "";
    if (db && !out.MOTHERDUCK_DATABASE) {
      out.MOTHERDUCK_DATABASE = db;
    }
    delete out.database;
  }
  return out;
}

/** Apply non-secret saved connection config onto credential form state. */
export function mergeLinkedConnectionFormValues(
  connector: string,
  config: Record<string, string>,
  prev: Record<string, string>
): Record<string, string> {
  const mapped = connectionConfigToFormValues(connector, config);
  const next = { ...prev };
  for (const [k, v] of Object.entries(mapped)) {
    if (CREDENTIAL_SENSITIVE_KEY_SET.has(k)) continue;
    if (v.trim()) next[k] = v;
  }
  return next;
}
