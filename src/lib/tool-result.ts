import { buildCitation, type Completeness, mergeCompleteness } from "@bio-mcp/shared";
import { DEFAULT_SNOMED_TX_BASE } from "./http";
import { shouldStage, stageToDoAndRespond } from "@bio-mcp/shared/staging/utils";

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
type Result = { content: Array<{ type: "text"; text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean; [key: string]: unknown };
export type SnowstormDataEnv = { SNOWSTORM_DATA_DO?: unknown; SNOMED_TX_BASE?: string };
export const snowstormSource = (env: SnowstormDataEnv) => ({ id: "snowstorm", name: "SNOMED CT via configured FHIR terminology server", url: (env.SNOMED_TX_BASE || DEFAULT_SNOMED_TX_BASE).replace(/\/$/, ""), license: "SNOMED CT content retains its provider licensing; anonymous access does not grant redistribution rights. Preserve the native copyright and licence metadata." });
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
// The MCP SDK adds resultType and serverInfo after this callback returns.
const TRANSPORT_METADATA_RESERVE = 1024;

function sourceFor(structured: Record<string, unknown>, env: SnowstormDataEnv) {
  const meta = record(structured._meta) ? structured._meta : {};
  const sourceValue = record(meta.citation) && record(meta.citation.source) ? meta.citation.source
    : record(structured.data) && record(structured.data.source) ? structured.data.source : record(meta.source) ? meta.source : undefined;
  return sourceValue && typeof sourceValue.id === "string" && typeof sourceValue.name === "string" && typeof sourceValue.url === "string"
    ? { id: sourceValue.id, name: sourceValue.name, url: sourceValue.url,
      ...(typeof sourceValue.license === "string" ? { license: sourceValue.license } : {}) } : snowstormSource(env);
}
async function cite(structured: Record<string, unknown>, toolName: string, query: unknown, env: SnowstormDataEnv) {
  const meta = record(structured._meta) ? structured._meta : {};
  if (record(meta.citation)) return structured;
  const { _meta: _metadata, ...root } = structured;
  const source = sourceFor(structured, env);
  const citation = await buildCitation({ source, server: "snowstorm", tool: toolName.replace(/^mcp_/, ""), query,
    queryScope: "tool_arguments", result: root, resultScope: "structured_content:root_without_meta", retrievedAt: new Date().toISOString() });
  return { ...structured, _meta: { ...meta, citation } };
}

/** Cite every response and stage the complete composed MCP envelope above 30KiB. */
export async function snowstormResponse(work: () => Promise<Result>, env: SnowstormDataEnv, toolName: string, extra: unknown, query: unknown = {}): Promise<Result> {
  try {
    const original: Result = await work().catch(error => {
      return requestFailure(error);
    });
    let structured = original.structuredContent ?? { success: original.isError !== true };
    const meta = record(structured._meta) ? structured._meta : {};
    const existing: Completeness | undefined = record(meta.completeness) && typeof meta.completeness.complete === "boolean"
      ? { ...meta.completeness, complete: meta.completeness.complete } : undefined;
    const completeness = mergeCompleteness(existing, !toolName.endsWith("query_data") && !toolName.endsWith("get_schema") && !toolName.endsWith("search") ? {
      complete: false, truncation: { reason: "unknown", detail: "Selected FHIR resources and translations do not establish exhaustive host content, map applicability or clinical equivalence.",
        remedy: "Retain host, edition, map versions, every match equivalence and dependency/product context. Check returned versions: a requested version may be ignored. Preserve Bundle continuation and source licensing." },
    } : undefined);
    if (completeness) structured = { ...structured, _meta: { ...meta, completeness },
      ...(record(structured._staging) ? { _staging: { ...structured._staging, completeness } } : {}) };
    const apiError = record(structured.data) && structured.data.__api_error === true;
    const failed = original.isError === true || structured.success === false || apiError || Boolean(structured.program_error) || structured.disposition === "partial";
    const result = { ...original, structuredContent: await cite(failed ? { ...structured, success: false } : structured, toolName, query, env), ...(failed ? { isError: true } : {}) };
    if (!shouldStage(bytes(result) + TRANSPORT_METADATA_RESERVE)) return result;
    return await stageResponse(env, result, toolName, extra, query, completeness, failed);
  } catch {
    const message = "Snowstorm source response could not be returned.";
    const data = { success: false, error: { code: "RESPONSE_ERROR", message } };
    const citation = await buildCitation({ source: snowstormSource(env), server: "snowstorm", tool: toolName.replace(/^mcp_/, ""),
      query, queryScope: "tool_arguments", retrievedAt: new Date().toISOString(), result: data, resultScope: "structured_content:root_without_meta" });
    return { content: [{ type: "text", text: message }], structuredContent: { ...data, _meta: { citation } }, isError: true };
  }
}

function requestFailure(error: unknown) : Result {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  const message = status && error instanceof Error ? error.message.slice(0, 500) : "Snowstorm source response could not be returned.";
  return {
    content: [{ type: "text" as const, text: message }], isError: true,
    structuredContent: {
      success: false, error: { code: status ? "API_ERROR" : "RESPONSE_ERROR", message, status },
      ...(error && typeof error === "object" && "data" in error ? { data: error.data } : {})
    }
  };
}

async function stageResponse(env: SnowstormDataEnv, result: Result & { structuredContent: Record<string, unknown> }, toolName: string, extra: unknown, query: unknown, completeness: Completeness | undefined, failed: unknown) : Promise<Result> {
  if (!env.SNOWSTORM_DATA_DO) throw new Error("Missing staging storage");
  const staged = await stageToDoAndRespond(result, env.SNOWSTORM_DATA_DO as Parameters<typeof stageToDoAndRespond>[1], "snowstorm", undefined,
    { toolName, serverName: "snowstorm" }, "snowstorm", extra as Parameters<typeof stageToDoAndRespond>[6]);
  const citation = await buildCitation({
    source: sourceFor(result.structuredContent, env), server: "snowstorm", tool: toolName.replace(/^mcp_/, ""),
    query, queryScope: "tool_arguments", retrievedAt: new Date().toISOString(), result, resultScope: "staged:full_result", dataAccessId: staged.dataAccessId
  });
  const combined = mergeCompleteness(completeness, staged._staging.completeness);
  const structuredContent = {
    success: !failed, staged: true, data: undefined, data_access_id: staged.dataAccessId,
    _staging: { ...staged._staging, ...(combined ? { completeness: combined } : {}) }, _meta: { citation, ...(combined ? { completeness: combined } : {}) }
  };
  if (bytes(structuredContent) > 100000) throw new Error("Staging metadata exceeds transport limit");
  return { content: [{ type: "text", text: "Response staged. Use snowstorm_query_data; payloads retains the complete original response." }], structuredContent, ...(failed ? { isError: true } : {}) };
}
