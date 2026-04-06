/** Best-effort redaction before persisting run logs or errors (never a substitute for not logging secrets). */
export function sanitizeForRunStorage(text: string, maxLen = 8000): string {
  let s = text.slice(0, maxLen);
  const patterns: RegExp[] = [
    /\b(sk_live_[a-zA-Z0-9]{20,})\b/gi,
    /\b(sk_test_[a-zA-Z0-9]{20,})\b/gi,
    /\b(xox[baprs]-[a-zA-Z0-9-]+)\b/gi,
    /\b(AKIA[0-9A-Z]{16})\b/g,
    /\b(ghp_[a-zA-Z0-9]{20,})\b/gi,
    /\b(gho_[a-zA-Z0-9]{20,})\b/gi,
    /(?:password|passwd|pwd|secret|token|apikey|api_key)\s*[=:]\s*\S+/gi,
  ];
  for (const p of patterns) {
    s = s.replace(p, "[redacted]");
  }
  return s;
}
