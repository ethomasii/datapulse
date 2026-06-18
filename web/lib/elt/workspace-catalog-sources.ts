import { db } from "@/lib/db/client";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { parseCatalogSource } from "@/lib/elt/component-packages/catalog-sources";

function normalizeUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).map((s) => s.trim()).filter(Boolean);
}

/** Org catalog URLs win over user when the workspace owner belongs to an org. */
export async function loadWorkspaceCatalogUrls(userId: string): Promise<string[]> {
  const perms = await getWorkspacePermissions(userId);
  const ownerId = perms.resourceOwnerIds[0] ?? userId;

  const user = await db.user.findUnique({
    where: { id: ownerId },
    select: { componentCatalogUrls: true, organizationId: true },
  });

  const org =
    user?.organizationId != null
      ? await db.organization.findUnique({
          where: { id: user.organizationId },
          select: { componentCatalogUrls: true },
        })
      : null;

  const orgUrls = normalizeUrlList(org?.componentCatalogUrls);
  if (orgUrls.length) return orgUrls;

  return normalizeUrlList(user?.componentCatalogUrls);
}

export function validateCatalogUrlList(urls: string[]): { ok: true; urls: string[] } | { ok: false; error: string } {
  if (urls.length > 20) {
    return { ok: false, error: "At most 20 catalog URLs allowed" };
  }
  const out: string[] = [];
  for (const u of urls) {
    const parsed = parseCatalogSource(u);
    if (!parsed) return { ok: false, error: `Invalid catalog URL: ${u}` };
    if (!out.includes(parsed.id)) out.push(u.trim());
  }
  return { ok: true, urls: out };
}
