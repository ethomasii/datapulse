export type RunErrorHint = {
  title: string;
  message: string;
  href?: string;
  hrefLabel?: string;
};

/** Turn raw run error text into actionable next steps in the product UI. */
export function hintsForRunFailure(errorSummary: string | null | undefined): RunErrorHint[] {
  const text = (errorSummary ?? "").toLowerCase();
  const hints: RunErrorHint[] = [];

  if (
    text.includes("secret") ||
    text.includes("credential") ||
    text.includes("token") ||
    text.includes("unauthorized") ||
    text.includes("401") ||
    text.includes("403")
  ) {
    hints.push({
      title: "Missing or invalid credentials",
      message: "Connect source and destination in Connections, then link them on the pipeline.",
      href: "/connections",
      hrefLabel: "Open connections",
    });
  }

  if (text.includes("encrypt") || text.includes("encryption key")) {
    hints.push({
      title: "Server encryption not configured",
      message: "Managed runs need ELTPULSE_TOKEN_ENCRYPTION_KEY on the deployment to decrypt stored secrets.",
    });
  }

  if (text.includes("exit") || text.includes("python") || text.includes("dlt") || text.includes("sling")) {
    hints.push({
      title: "Execution failed in the worker",
      message: "Open run logs for stderr. Fix generated code or source config in the builder, then re-run.",
      href: "/builder",
      hrefLabel: "Open builder",
    });
  }

  if (text.includes("stub") || text.includes("demo") || text.includes("managed sync")) {
    hints.push({
      title: "Demo / stub execution",
      message:
        "This run used demo telemetry. Configure GitHub Actions or a gateway for real dlt/Sling execution.",
      href: "/gateway",
      hrefLabel: "Execution settings",
    });
  }

  if (hints.length === 0 && errorSummary?.trim()) {
    hints.push({
      title: "Run failed",
      message: errorSummary.slice(0, 400),
      href: "/help",
      hrefLabel: "Help center",
    });
  }

  return hints;
}
