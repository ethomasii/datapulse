import type { NativeComponentDefinition } from "../types";
import { emitRagPipelinePython } from "../mcp-python-runtime";

function envVarFromConfig(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  const m = s.match(/^\$\{([^}]+)\}$/);
  return m ? m[1]!.trim() : s;
}

export const ragPipelineComponent: NativeComponentDefinition = {
  id: "rag_pipeline",
  name: "RAG pipeline",
  category: "ai",
  description:
    "Per-row retrieve-and-generate — embed query, search vector store, answer with LLM.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Input table", type: "string", required: true },
    { key: "query_column", label: "Query column", type: "string", default: "query" },
    { key: "answer_column", label: "Answer column", type: "string", default: "answer" },
    { key: "sources_column", label: "Sources column", type: "string", default: "sources" },
    {
      key: "vector_store_provider",
      label: "Vector store",
      type: "select",
      options: ["chromadb", "pinecone"],
      default: "chromadb",
    },
    { key: "collection_name", label: "Collection / index name", type: "string", required: true },
    { key: "vector_store_connection", label: "Vector store path / connection", type: "string" },
    {
      key: "llm_provider",
      label: "LLM provider",
      type: "select",
      options: ["openai", "anthropic"],
      default: "openai",
    },
    { key: "llm_model", label: "LLM model", type: "string", required: true, default: "gpt-4o-mini" },
    {
      key: "embedding_provider",
      label: "Embedding provider",
      type: "select",
      options: ["openai"],
      default: "openai",
    },
    { key: "embedding_model", label: "Embedding model", type: "string", default: "text-embedding-3-small" },
    { key: "llm_api_key", label: "LLM API key env var", type: "string", placeholder: "OPENAI_API_KEY" },
    { key: "embedding_api_key", label: "Embedding API key env var", type: "string", placeholder: "OPENAI_API_KEY" },
    { key: "top_k", label: "Top K documents", type: "number", default: 5 },
    { key: "temperature", label: "Temperature", type: "number", default: 0.7 },
    { key: "include_sources", label: "Include sources column", type: "boolean", default: true },
    { key: "output_table", label: "Output table", type: "string", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? config.upstream_asset_key ?? "").trim();
    const outputTable = String(config.output_table ?? config.asset_name ?? "").trim();
    const queryColumn = String(config.query_column ?? "query").trim();
    const answerColumn = String(config.answer_column ?? "answer").trim();
    const sourcesColumn = String(config.sources_column ?? "sources").trim();
    const vectorStoreProvider = String(config.vector_store_provider ?? "chromadb").trim();
    const collectionName = String(config.collection_name ?? "").trim();
    const llmProvider = String(config.llm_provider ?? "openai").trim();
    const llmModel = String(config.llm_model ?? "gpt-4o-mini").trim();
    const embeddingProvider = String(config.embedding_provider ?? "openai").trim();
    const embeddingModel = String(config.embedding_model ?? "text-embedding-3-small").trim();
    const topK = Number(config.top_k ?? 5);
    const temperature = Number(config.temperature ?? 0.7);
    const includeSources = config.include_sources !== false;

    if (!table || !outputTable) {
      return { warnings: ["rag_pipeline: table and output_table required"], python: [] };
    }
    if (!collectionName) {
      return { warnings: ["rag_pipeline: collection_name is required"], python: [] };
    }
    if (!llmModel) {
      return { warnings: ["rag_pipeline: llm_model is required"], python: [] };
    }

    return {
      python: emitRagPipelinePython({
        label: table,
        table,
        queryColumn,
        answerColumn,
        sourcesColumn,
        vectorStoreProvider,
        collectionName,
        vectorStoreConnection: String(config.vector_store_connection ?? "").trim() || undefined,
        llmProvider,
        llmModel,
        llmApiKeyEnv: envVarFromConfig(config.llm_api_key),
        embeddingProvider,
        embeddingModel,
        embeddingApiKeyEnv: envVarFromConfig(config.embedding_api_key),
        topK: Number.isFinite(topK) ? topK : 5,
        temperature: Number.isFinite(temperature) ? temperature : 0.7,
        includeSources,
        outputTable,
      }),
    };
  },
};
