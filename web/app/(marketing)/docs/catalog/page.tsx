import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Catalog & workspace assets",
  description:
    "Browse the authenticated workspace catalog, tag assets for consumers, and control access with team roles.",
};

export default function CatalogDocsPage() {
  return (
    <DocsProse>
      <h1>Catalog &amp; workspace assets</h1>
      <p>
        eltPulse exposes an <strong>authenticated catalog</strong> for everyone in a workspace — not a public internet
        Signed-in users browse pipelines, connections, transform outputs, and optional git SQL projects; team roles
        control who can edit metadata and who sees the full catalog vs public-tagged entries only.
      </p>

      <h2>Where to browse</h2>
      <ul>
        <li>
          <Link href="/catalog">Catalog hub</Link> — overview counts, transform recipes, search entry points.
        </li>
        <li>
          <Link href="/catalog/components">Transforms</Link> — lake pipeline recipes and warehouse SQL components (no git
          required).
        </li>
        <li>
          <Link href="/assets">Workspace assets</Link> — landing tables, transform outputs, lineage, warehouse
          verification.
        </li>
        <li>
          <Link href="/catalog/dbt">Git SQL projects</Link> — optional dbt projects (standalone or linked to pipelines).
        </li>
      </ul>

      <h2>Metadata for data consumers</h2>
      <p>
        Each asset can carry a <strong>description</strong> and <strong>tags</strong> stored as catalog entries. Use tags
        like <code>catalog:public</code> or <code>public</code> to mark datasets that catalog-browser teammates may see
        when their role restricts visibility to public entries only.
      </p>
      <p>
        Users with <strong>catalog editor</strong> or <strong>member</strong> roles can update descriptions and tags from
        asset detail pages or the assets list (import from pipelines when permitted). Viewers and catalog browsers cannot
        edit metadata.
      </p>

      <h2>Team roles (RBAC)</h2>
      <p>
        Organization owners invite teammates from <Link href="/team">Team</Link> with one of these roles:
      </p>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Catalog browse</th>
            <th>Edit metadata</th>
            <th>Pipelines / canvas / dbt admin</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Member</strong>
            </td>
            <td>Full</td>
            <td>Yes</td>
            <td>Full write</td>
          </tr>
          <tr>
            <td>
              <strong>Viewer</strong>
            </td>
            <td>Full</td>
            <td>No</td>
            <td>Read-only</td>
          </tr>
          <tr>
            <td>
              <strong>Catalog editor</strong>
            </td>
            <td>Full</td>
            <td>Yes</td>
            <td>Read-only (no pipeline saves, no dbt project create/run)</td>
          </tr>
          <tr>
            <td>
              <strong>Catalog browser</strong>
            </td>
            <td>Public-tagged only</td>
            <td>No</td>
            <td>Read-only</td>
          </tr>
        </tbody>
      </table>
      <p>
        API keys may include <code>catalog:read</code> and <code>catalog:write</code> scopes in addition to pipeline
        scopes. Catalog write allows metadata edits without full pipeline write.
      </p>

      <h2>API</h2>
      <ul>
        <li>
          <code>GET /api/elt/catalog/overview</code> — summary counts (filtered by visibility).
        </li>
        <li>
          <code>GET /api/elt/catalog/search</code> — search entries (visibility filter applied server-side).
        </li>
        <li>
          <code>PUT /api/elt/catalog/entries</code> — upsert description/tags (requires catalog edit permission).
        </li>
        <li>
          <code>GET /api/elt/assets</code> — workspace asset map (public-only filter for catalog browsers).
        </li>
        <li>
          <code>GET /api/elt/workspace/permissions</code> — current user role flags for UI gating.
        </li>
      </ul>

      <p>
        <Link href="/docs/security">Security &amp; data</Link> · <Link href="/docs/dbt">dbt transforms</Link> ·{" "}
        <Link href="/docs/pipelines">Pipelines</Link>
      </p>
    </DocsProse>
  );
}
