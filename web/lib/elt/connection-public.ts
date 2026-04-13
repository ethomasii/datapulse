/** Strip ciphertext from API responses; expose only a boolean for the UI. */
export function toPublicConnection<T extends { connectionSecretsEnc?: string | null }>(row: T) {
  const { connectionSecretsEnc: enc, ...rest } = row;
  return {
    ...(rest as Omit<T, "connectionSecretsEnc">),
    hasStoredSecrets: Boolean(enc),
  };
}
