/** Data contract schema spec and compliance checks against catalog assets. */

export type ContractColumnSpec = {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
};

export type ContractCompliance = {
  ok: boolean;
  issues: string[];
  freshnessOk: boolean;
  schemaOk: boolean;
  missingColumns: string[];
  extraInfo: string[];
};

export function parseContractSchemaSpec(raw: unknown): ContractColumnSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === "object" && typeof (c as ContractColumnSpec).name === "string")
    .map((c) => {
      const col = c as ContractColumnSpec;
      return {
        name: col.name.trim(),
        ...(col.type ? { type: String(col.type).slice(0, 128) } : {}),
        ...(col.required ? { required: true } : {}),
        ...(col.description ? { description: String(col.description).slice(0, 2000) } : {}),
      };
    });
}

export function evaluateContractCompliance(input: {
  schemaSpec: unknown;
  freshnessSlaHours?: number | null;
  lastRunFinishedAt?: string | null;
  lastRunStatus?: string | null;
  assetColumns?: { name: string; type?: string }[];
}): ContractCompliance {
  const spec = parseContractSchemaSpec(input.schemaSpec);
  const issues: string[] = [];
  const extraInfo: string[] = [];
  const assetColNames = new Set((input.assetColumns ?? []).map((c) => c.name.toLowerCase()));

  const missingColumns = spec.filter((c) => c.required && !assetColNames.has(c.name.toLowerCase())).map((c) => c.name);

  let schemaOk = missingColumns.length === 0;
  if (missingColumns.length) {
    issues.push(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  for (const col of spec) {
    if (!col.required && !assetColNames.has(col.name.toLowerCase())) {
      extraInfo.push(`Optional column not present: ${col.name}`);
    }
  }

  let freshnessOk = true;
  if (input.freshnessSlaHours && input.lastRunFinishedAt) {
    const ageMs = Date.now() - Date.parse(input.lastRunFinishedAt);
    const slaMs = input.freshnessSlaHours * 60 * 60 * 1000;
    if (ageMs > slaMs) {
      freshnessOk = false;
      issues.push(`Data older than SLA (${input.freshnessSlaHours}h)`);
    }
  } else if (input.freshnessSlaHours && !input.lastRunFinishedAt) {
    freshnessOk = false;
    issues.push("No successful run recorded for freshness SLA check");
  }

  if (input.lastRunStatus === "failed") {
    issues.push("Last pipeline run failed");
  }

  return {
    ok: issues.length === 0,
    issues,
    freshnessOk,
    schemaOk,
    missingColumns,
    extraInfo,
  };
}
