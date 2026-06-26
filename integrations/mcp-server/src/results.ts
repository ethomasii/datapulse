import { EltPulseApiError } from "./client.js";

export function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function errorResult(err: unknown) {
  const message =
    err instanceof EltPulseApiError
      ? err.toDisplayString()
      : err instanceof Error
        ? err.message
        : String(err);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}
