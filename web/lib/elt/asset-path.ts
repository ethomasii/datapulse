/** URL helpers for workspace asset detail routes. */

export function assetDetailHref(assetKey: string): string {
  return `/assets/${encodeURIComponent(assetKey)}`;
}

export function decodeAssetKeyParam(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
