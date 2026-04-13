/**
 * Next.js 15+ passes `context.params` as a Promise for dynamic routes; older versions use a plain object.
 */
export async function resolveRouteParamId(
  params: { id: string } | Promise<{ id: string }>
): Promise<string> {
  const p = await Promise.resolve(params);
  return p.id;
}
