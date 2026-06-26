import type { NativeComponentDefinition } from "../types";
import { emitLitellmInferencePython } from "../mcp-python-runtime";

export const litellmInferenceComponent: NativeComponentDefinition = {
  id: "litellm_inference_asset",
  aliases: ["llm_prompt_executor", "openai_llm", "anthropic_llm", "gemini_llm"],
  name: "LLM row enrichment",
  category: "ai",
  description: "Per-row LLM text generation via LiteLLM — adds an output column from a prompt column.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", required: true },
    { key: "prompt_column", label: "Prompt column", type: "string", required: true },
    { key: "output_column", label: "Output column", type: "string", default: "llm_output" },
    { key: "model", label: "Model", type: "string", default: "gpt-4o-mini" },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
    const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
    const promptColumn = String(config.prompt_column ?? config.input_column ?? "prompt").trim();
    const outputColumn = String(config.output_column ?? "llm_output").trim();
    const model = String(config.model ?? "gpt-4o-mini").trim();

    if (!table || !outputTable) {
      return { warnings: ["litellm_inference_asset: table and output_table required"], python: [] };
    }

    return {
      python: emitLitellmInferencePython({
        label: table,
        table,
        promptColumn,
        outputColumn,
        model,
        outputTable,
      }),
    };
  },
};
