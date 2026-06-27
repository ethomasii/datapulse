/** Read a fetch Response body as JSON, with readable errors for plain-text/HTML failures. */
export async function readFetchJsonBody<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText || "Error"}`.trim());
    }
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.trim().slice(0, 240);
    if (!res.ok) {
      throw new Error(snippet || `${res.status} ${res.statusText || "Error"}`.trim());
    }
    throw new Error(`Unexpected non-JSON response: ${snippet}`);
  }
}

/** Client-side helper for preview/column fetch calls. */
export async function readClientFetchJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  return readFetchJsonBody<T>(res);
}
