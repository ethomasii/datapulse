import type { DltHubSource } from "@/lib/elt/dlt-hub-registry";

/** Catalog sources that use Sling + live table discovery (postgres/mysql). */
export function isDatabaseCatalogSource(source: Pick<DltHubSource, "category" | "slug">): boolean {
  const slug = source.slug.toLowerCase();
  return (
    source.category === "Databases" ||
    slug === "sql_database" ||
    slug === "pg_replication" ||
    slug === "postgres" ||
    slug === "postgresql" ||
    slug === "mysql"
  );
}

export function databaseSourceConnectors(source: Pick<DltHubSource, "slug">): string[] {
  const slug = source.slug.toLowerCase();
  if (slug.includes("mysql")) return ["mysql"];
  if (slug === "pg_replication" || slug.includes("postgres")) return ["postgres", "postgresql"];
  return ["postgres", "postgresql", "mysql"];
}

export function pipelineSourceTypeFromConnector(connector: string): string {
  const c = connector.toLowerCase();
  if (c === "mysql") return "mysql";
  if (c === "postgresql") return "postgres";
  return c;
}
