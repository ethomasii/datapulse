import { joinTablesComponent } from "./definitions/join-tables";
import { filterRowsComponent } from "./definitions/filter-rows";
import { dqCheckComponent } from "./definitions/dq-check";
import { mcpToolCallComponent } from "./definitions/mcp-tool-call";
import { litellmAgentComponent } from "./definitions/litellm-agent";
import { litellmInferenceComponent } from "./definitions/litellm-inference";
import { litellmStructuredOutputComponent } from "./definitions/litellm-structured-output";
import { litellmFunctionCallingComponent } from "./definitions/litellm-function-calling";
import { ragPipelineComponent } from "./definitions/rag-pipeline";
import { llmEvaluatorComponent } from "./definitions/llm-evaluator";
import { sqlTransformComponent } from "./definitions/sql-transform";
import { selectColumnsComponent } from "./definitions/select-columns";
import { dropDuplicatesComponent } from "./definitions/drop-duplicates";
import { unionTablesComponent } from "./definitions/union-tables";
import { uniqueCheckComponent } from "./definitions/unique-check";
import {
  s3MonitorComponent,
  sqsMonitorComponent,
  gcsMonitorComponent,
  kafkaMonitorComponent,
  sqlMonitorComponent,
} from "./definitions/sensor-monitors";
import { s3IngestComponent, sqsIngestComponent, kafkaIngestComponent, restApiIngestComponent, sqlToDatabaseComponent, gcsIngestComponent, deltaIngestComponent, mongodbIngestComponent, googleSheetsIngestComponent } from "./definitions/ingestion-hints";
import { renameColumnsComponent, castColumnsComponent } from "./definitions/column-ops";
import {
  groupAggregateComponent,
  sortRowsComponent,
  limitRowsComponent,
  fillNullsComponent,
  replaceValuesComponent,
  sampleRowsComponent,
  addColumnExprComponent,
} from "./definitions/table-ops";
import {
  pivotComponent,
  crossJoinComponent,
  antiJoinComponent,
  dataCleansingComponent,
  datetimeParserComponent,
} from "./definitions/analytics-transforms";
import {
  unpivotComponent,
  rankComponent,
  runningTotalComponent,
  recordIdComponent,
  textToColumnsComponent,
  jsonFlattenComponent,
  oneHotEncodingComponent,
  trainTestSplitComponent,
  topNPerGroupComponent,
  countRecordsComponent,
  auditColumnsComponent,
  semiJoinComponent,
} from "./definitions/more-transforms";
import {
  hl7V2ParserComponent,
  fixMessageParserComponent,
  emailParserComponent,
  regexParserComponent,
  htmlParserComponent,
} from "./definitions/domain-parsers";
import {
  hashComponent,
  transposeComponent,
  arrayExploderComponent,
  alterRowComponent,
  appendFieldsComponent,
  nestedFieldExtractorComponent,
  multiRowFormulaComponent,
  windowCalculationComponent,
  outlierClipperComponent,
  pctChangeComponent,
  weightedAverageComponent,
  routerComponent,
  dataMaskingComponent,
  schemaValidatorComponent,
  xmlParserComponent,
} from "./definitions/advanced-transforms";
import { scdType1Component, scdType2Component } from "./definitions/scd-transforms";
import { parseMcpVirtualComponentId } from "@/lib/elt/mcp-server/virtual-components";
import type { NativeComponentDefinition } from "./types";

const ALL_NATIVE: NativeComponentDefinition[] = [
  joinTablesComponent,
  filterRowsComponent,
  dqCheckComponent,
  mcpToolCallComponent,
  litellmAgentComponent,
  litellmInferenceComponent,
  litellmStructuredOutputComponent,
  litellmFunctionCallingComponent,
  ragPipelineComponent,
  llmEvaluatorComponent,
  sqlTransformComponent,
  selectColumnsComponent,
  dropDuplicatesComponent,
  unionTablesComponent,
  uniqueCheckComponent,
  renameColumnsComponent,
  castColumnsComponent,
  groupAggregateComponent,
  sortRowsComponent,
  limitRowsComponent,
  fillNullsComponent,
  replaceValuesComponent,
  sampleRowsComponent,
  addColumnExprComponent,
  s3MonitorComponent,
  sqsMonitorComponent,
  gcsMonitorComponent,
  kafkaMonitorComponent,
  sqlMonitorComponent,
  s3IngestComponent,
  sqsIngestComponent,
  kafkaIngestComponent,
  restApiIngestComponent,
  sqlToDatabaseComponent,
  pivotComponent,
  crossJoinComponent,
  antiJoinComponent,
  dataCleansingComponent,
  datetimeParserComponent,
  unpivotComponent,
  rankComponent,
  runningTotalComponent,
  recordIdComponent,
  textToColumnsComponent,
  jsonFlattenComponent,
  oneHotEncodingComponent,
  trainTestSplitComponent,
  topNPerGroupComponent,
  countRecordsComponent,
  auditColumnsComponent,
  semiJoinComponent,
  gcsIngestComponent,
  hl7V2ParserComponent,
  fixMessageParserComponent,
  emailParserComponent,
  regexParserComponent,
  htmlParserComponent,
  hashComponent,
  transposeComponent,
  arrayExploderComponent,
  alterRowComponent,
  appendFieldsComponent,
  nestedFieldExtractorComponent,
  multiRowFormulaComponent,
  windowCalculationComponent,
  outlierClipperComponent,
  pctChangeComponent,
  weightedAverageComponent,
  routerComponent,
  dataMaskingComponent,
  schemaValidatorComponent,
  xmlParserComponent,
  scdType1Component,
  scdType2Component,
  deltaIngestComponent,
  mongodbIngestComponent,
  googleSheetsIngestComponent,
];

const byId = new Map<string, NativeComponentDefinition>();
for (const def of ALL_NATIVE) {
  byId.set(def.id, def);
  for (const alias of def.aliases ?? []) {
    byId.set(alias, def);
  }
}

export function listNativeComponents(): NativeComponentDefinition[] {
  const seen = new Set<string>();
  return ALL_NATIVE.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

export function getNativeComponent(id: string): NativeComponentDefinition | null {
  const key = id.trim();
  if (!key) return null;
  return byId.get(key) ?? null;
}

export function isNativeComponent(id: string): boolean {
  const key = id.trim();
  if (parseMcpVirtualComponentId(key)) return true;
  return getNativeComponent(key) !== null;
}

export function resolveNativeComponentId(config: Record<string, unknown>): string | null {
  const templateId = String(config.template_id ?? "").trim();
  if (templateId) {
    if (parseMcpVirtualComponentId(templateId)) return "mcp_tool_call";
    if (byId.has(templateId)) return byId.get(templateId)!.id;
  }
  const componentId = String(config.component_id ?? "").trim();
  if (componentId) {
    if (parseMcpVirtualComponentId(componentId)) return "mcp_tool_call";
    if (byId.has(componentId)) return byId.get(componentId)!.id;
  }
  return null;
}
