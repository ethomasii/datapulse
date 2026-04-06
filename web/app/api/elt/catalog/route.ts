import { NextResponse } from "next/server";
import {
  DESTINATION_GROUPS,
  DESTINATION_TYPES,
  SOURCE_GROUPS,
  SOURCE_TYPES,
} from "@/lib/elt/catalog";
import { CREDENTIAL_HINTS } from "@/lib/elt/credential-hints";

export async function GET() {
  return NextResponse.json({
    sourceGroups: SOURCE_GROUPS,
    destinationGroups: DESTINATION_GROUPS,
    sources: SOURCE_TYPES,
    destinations: DESTINATION_TYPES,
    credentialHints: CREDENTIAL_HINTS,
  });
}
