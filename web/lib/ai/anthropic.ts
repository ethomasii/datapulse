import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client. Returns null when ANTHROPIC_API_KEY is unset.
 */
export function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}
