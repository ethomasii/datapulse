import type { NativeComponentDefinition } from "../types";
import { emitLlmEvaluatorPython } from "../mcp-python-runtime";

export const llmEvaluatorComponent: NativeComponentDefinition = {
  id: "llm_evaluator",
  name: "LLM evaluator (judge)",
  category: "ai",
  description: "LLM-as-judge scores upstream agent/LLM output (answer relevance, groundedness, etc.).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", required: true },
    { key: "input_column", label: "Answer column", type: "string", required: true },
    { key: "reference_column", label: "Reference column", type: "string" },
    {
      key: "feedback",
      label: "Feedback metric",
      type: "select",
      options: ["answer_relevance", "groundedness", "helpfulness", "coherence", "harmfulness"],
      default: "answer_relevance",
    },
    { key: "model", label: "Judge model", type: "string", default: "gpt-4o-mini" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
    const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
    const inputColumn = String(config.input_column ?? "answer").trim();
    const feedback = String(config.feedback ?? "answer_relevance").trim();
    const model = String(config.model ?? "gpt-4o-mini").trim();

    if (!table || !outputTable) {
      return { warnings: ["llm_evaluator: table and output_table required"], python: [] };
    }

    return {
      python: emitLlmEvaluatorPython({
        label: feedback,
        table,
        inputColumn,
        referenceColumn: String(config.reference_column ?? "").trim() || undefined,
        feedback,
        model,
        outputTable,
      }),
    };
  },
};
