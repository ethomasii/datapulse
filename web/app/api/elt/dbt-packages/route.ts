import { NextResponse } from "next/server";
import { DBT_HUB_PACKAGES, listDbtHubPackages, resolveDbtHubPackage } from "@/lib/elt/dbt-hub-packages";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source")?.trim();

  if (source) {
    const pkg = resolveDbtHubPackage(source);
    if (!pkg) {
      return NextResponse.json({
        available: false,
        source,
        message: `No dlt-hub dbt package mapped for source "${source}". Use a custom dbt project path.`,
      });
    }
    return NextResponse.json({ available: true, source, package: pkg });
  }

  return NextResponse.json({ packages: DBT_HUB_PACKAGES });
}
