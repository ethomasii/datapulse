const URL_RE = /https?:\/\/[^\s)]+/;

export type ParsedCredentialHelp = {
  text?: string;
  url?: string;
};

/** Split inline help into readable text and an optional link (for token how-to). */
export function parseCredentialHelp(help?: string, helpUrl?: string): ParsedCredentialHelp {
  if (helpUrl?.trim()) {
    return {
      text: help?.trim() || undefined,
      url: helpUrl.trim(),
    };
  }
  const raw = help?.trim();
  if (!raw) return {};

  if (/^https?:\/\//i.test(raw)) {
    return { url: raw.replace(/[.,]$/, "") };
  }

  const match = raw.match(URL_RE);
  if (!match) {
    return { text: raw };
  }

  const url = match[0].replace(/[.,]$/, "");
  let text = raw
    .replace(match[0], "")
    .replace(/\s*→\s*/g, " ")
    .replace(/\s*—\s*/g, " ")
    .replace(/Create at:\s*/i, "")
    .replace(/Create at\s*/i, "")
    .replace(/Find at:\s*/i, "")
    .replace(/Find in\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { text: text || undefined, url };
}
