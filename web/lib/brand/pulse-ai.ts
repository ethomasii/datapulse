/** User-facing name for eltPulse's Claude-powered pipeline assistant. */
export const PULSE_AI_NAME = "Pulse AI";
export const PULSE_AI_SHORT = "Pulse";

/** Shown on gated surfaces so users see what Team unlocks. */
export const PULSE_AI_CAPABILITIES = [
  "Scaffold pipelines from plain English (source → destination)",
  "Add transform steps, quality checks, and sensors on the canvas",
  "Patch step configs and wire the graph — you review before save",
] as const;

export const PULSE_AI_EXAMPLE_PROMPTS = [
  "Load GitHub issues and PRs into Snowflake",
  "GitHub → Snowflake with not-null checks on issues.id",
  "Build medallion layers — cleanse, dedupe, gold rollup",
  "Add a filter and daily aggregate after the load step",
] as const;

export const PULSE_AI_TEAM_GATE_MESSAGE =
  "Pulse AI builds and edits pipelines from natural language. Available on the Team plan — try the visual builder and catalog on Free and Pro.";
