/** Escape user content embedded in generated Python source. */
export function escapePyString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
