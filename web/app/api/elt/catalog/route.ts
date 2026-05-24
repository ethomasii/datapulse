import { NextResponse } from "next/server";
import {
  DESTINATION_GROUPS,
  DESTINATION_TYPES,
  SOURCE_GROUPS,
  SOURCE_TYPES,
} from "@/lib/elt/catalog";
import { ALL_CONNECTORS } from "@/lib/elt/connectors-registry";

export async function GET() {
  const credentialHints = Object.fromEntries(
    ALL_CONNECTORS
      .filter((c) => (c.credentialFields?.length ?? 0) > 0)
      .map((c) => [c.slug, c.credentialFields!.map((f) => ({ key: f.key, label: f.label, help: f.help }))])
  );
  return NextResponse.json({
    sourceGroups: SOURCE_GROUPS,
    destinationGroups: DESTINATION_GROUPS,
    sources: SOURCE_TYPES,
    destinations: DESTINATION_TYPES,
    credentialHints,
  });
}
