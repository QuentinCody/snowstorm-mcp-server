import { afterEach, expect, it, vi } from "vitest";
import { McpServer } from "@bio-mcp/shared/mcp";
import type { ExecuteToolOptions } from "@bio-mcp/shared/codemode/execute-tool";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { registerCodeMode } from "./code-mode";
import { registerQueryData } from "./query-data";
import { registerGetSchema } from "./get-schema";
import { DEFAULT_SNOMED_TX_BASE, setSnomedTxBase } from "../lib/http";

const captured = vi.hoisted(() => ({ options: [] as ExecuteToolOptions[] }));
vi.mock("@bio-mcp/shared/codemode/execute-tool", async importOriginal => {
  const actual = await importOriginal<typeof import("@bio-mcp/shared/codemode/execute-tool")>();
  return { ...actual, createExecuteTool: (options: ExecuteToolOptions) => { captured.options.push(options); return actual.createExecuteTool(options); } };
});
afterEach(() => { vi.unstubAllGlobals(); captured.options.length = 0; setSnomedTxBase(DEFAULT_SNOMED_TX_BASE); });

function registered(base?: string) {
  const server = new McpServer({ name: "fixture", version: "1" });
  // SAFETY: fixture loader is never invoked by catalog/invalid-code tests.
  registerCodeMode(server, { SNOMED_TX_BASE: base, CODE_MODE_LOADER: { get: () => ({}) } } as unknown as Parameters<typeof registerCodeMode>[1]);
  registerQueryData(server, {}); registerGetSchema(server, {});
  // SAFETY: SDK registry inspection exercises actual registered callbacks.
  return (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<unknown> }> })._registeredTools;
}

it("binds configured/default catalogs, citations and requests independently without inventing a content version", async () => {
  registered("https://r4.ontoserver.csiro.au/fhir/");
  setSnomedTxBase("https://legacy.example/fhir");
  registered();
  const [alternate, normal] = captured.options;
  expect(alternate.source).toMatchObject({ url: "https://r4.ontoserver.csiro.au/fhir" });
  expect(normal.source).toMatchObject({ url: DEFAULT_SNOMED_TX_BASE });
  expect(alternate.source).not.toHaveProperty("version");
  expect(normal.source).not.toHaveProperty("version");
  expect(alternate.catalog?.baseUrl).toBe(alternate.source?.url);
  expect(normal.catalog?.baseUrl).toBe(normal.source?.url);
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ resourceType: "CapabilityStatement" })); vi.stubGlobal("fetch", fetcher);
  await alternate.apiFetch({ method: "GET", path: "/metadata" });
  await normal.apiFetch({ method: "GET", path: "/metadata" });
  expect(fetcher.mock.calls.map(call => call[0])).toEqual(["https://r4.ontoserver.csiro.au/fhir/metadata", "https://tx.fhir.org/r4/metadata"]);
});

it("registers both aliases and both response fields for search success and tool errors", async () => {
  const tools = registered();
  expect(Object.keys(tools)).toHaveLength(8);
  for (const prefix of ["", "mcp_"]) {
    expect(await tools[prefix + "snowstorm_search"].handler({ query: "mapping", max_results: 5 }, {})).toMatchObject({ content: expect.any(Array), structuredContent: { success: true } });
    for (const [name, args] of [["snowstorm_execute", { code: "" }], ["snowstorm_query_data", { data_access_id: "fixture", sql: "SELECT 1" }], ["snowstorm_get_schema", { data_access_id: "fixture" }]] as const) {
      expect(await tools[prefix + name].handler(args, {})).toMatchObject({ content: expect.any(Array), structuredContent: expect.any(Object), isError: true });
    }
  }
});

it("stages complete FHIR Parameters with match semantics above the configured threshold", async () => {
  registered(); const options = captured.options[0];
  expect(options).toMatchObject({ maxInlineBytes: 30 * 1024, stagingThreshold: 30 * 1024 });
  const native = { resourceType: "Parameters", parameter: [{ name: "result", valueBoolean: false }, { name: "match", part: [{ name: "equivalence", valueCode: "disjoint" }, { name: "concept", valueCoding: { code: "0001", system: "urn:example:target" } }, { name: "note", valueString: "α".repeat(20000) }] }] };
  vi.stubGlobal("fetch", async () => Response.json(native));
  const stored: unknown[] = [];
  const namespace = { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
    if (new URL(request.url).pathname === "/process") {
      // SAFETY: shared staging sends a data envelope to this route.
      const payload = await request.json() as { data: unknown }; stored.push(payload.data);
      return Response.json({ success: true, tables_created: ["parameters"], total_rows: 2 });
    }
    return Response.json({ success: true, schema: { tables: { parameters: { columns: [{ name: "name" }] } } } });
  } }) };
  const proxy = createApiProxyTool({ apiFetch: options.apiFetch, catalog: options.catalog, doNamespace: namespace, stagingPrefix: "snowstorm", maxInlineBytes: options.maxInlineBytes });
  const result = await proxy.handler({ method: "GET", path: "/ConceptMap/$translate", params: { url: "urn:example:map", code: "0001", system: "urn:example:source" } }, { sql: () => [] });
  expect(result).toMatchObject({ __staged: true, data_access_id: expect.any(String), _staging: expect.any(Object) });
  expect(stored.map(value => typeof value === "string" ? JSON.parse(value) : value)).toContainEqual(native);
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(100000);
});
