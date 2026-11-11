/// <reference types="node" />
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
import { buildKnownEndpointIndex, preflightUnknownEndpoint } from "@bio-mcp/shared/tools/api-proxy-drift";
import { createSnowstormApiFetch } from "../lib/api-adapter";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { DEFAULT_SNOMED_TX_BASE, setSnomedTxBase } from "../lib/http";
import { snowstormCatalog } from "./catalog";
import { discoveryWorkflow, mappingEndpoints, translationWorkflow } from "./mapping";

afterEach(() => { vi.unstubAllGlobals(); setSnomedTxBase(DEFAULT_SNOMED_TX_BASE); });

it("matches the literal translate route before the ConceptMap resource-id template", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ resourceType: "Parameters", parameter: [{ name: "result", valueBoolean: false }] })));
  const proxy = createApiProxyTool({ apiFetch: createSnowstormApiFetch(), catalog: snowstormCatalog, stagingPrefix: "snowstorm" });
  const result = await proxy.handler({ method: "GET", path: "/ConceptMap/$translate", params: { url: "urn:map", conceptMapVersion: "1", code: "001", system: "urn:source", source: "urn:source-scope", target: "urn:target-scope" } }, { sql: () => [] });
  expect(result).not.toHaveProperty("__unfiltered_warning");
  expect(result).toMatchObject({ resourceType: "Parameters", parameter: [{ name: "result", valueBoolean: false }] });
});

// Synthetic FHIR R4 Parameters: a true overall result can include excluded and
// broader matches, not just an equivalent target. Preserve every part.
const translation = { resourceType: "Parameters", parameter: [
  { name: "result", valueBoolean: true },
  { name: "message", valueString: "Additional context may improve this result" },
  ...["equivalent", "wider", "disjoint", "unmatched"].map((equivalence, index) => ({ name: "match", part: [
    { name: "equivalence", valueCode: equivalence },
    { name: "concept", valueCoding: { system: "urn:example:target", code: `00${index}`, version: "2026", display: "Synthetic" } },
    { name: "source", valueUri: "urn:example:map" },
    { name: "product", part: [{ name: "element", valueUri: "urn:example:context" }, { name: "concept", valueCodeableConcept: { text: "context" } }] },
  ] })),
] };

it("preserves all translation matches, equivalence, versions, warnings and dependencies", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(translation)); vi.stubGlobal("fetch", fetcher);
  const result = await createSnowstormApiFetch()({ method: "GET", path: "/ConceptMap/$translate", params: {
    url: "urn:example:map", conceptMapVersion: "map-v2", code: "0001", system: "urn:example:source", version: "source-v3", source: "urn:example:source-vs", target: "urn:example:target-vs", reverse: false,
  } });
  expect(result.data).toEqual(translation);
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ code: "0001", conceptMapVersion: "map-v2", version: "source-v3", reverse: "false" });
});

it("preserves POST FHIR Parameters and query options together", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(translation)); vi.stubGlobal("fetch", fetcher);
  const body = { resourceType: "Parameters", parameter: [
    { name: "url", valueUri: "urn:example:map" },
    { name: "coding", valueCoding: { system: "urn:example:source", code: "0001", version: "v3" } },
    { name: "dependency", part: [{ name: "element", valueUri: "urn:example:context" }, { name: "concept", valueCodeableConcept: { text: "context" } }] },
  ] };
  expect((await createSnowstormApiFetch()({ method: "POST", path: "/ConceptMap/$translate", body, params: { _format: "json" } })).data).toEqual(translation);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(body);
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("_format")).toBe("json");
});

it("keeps no-match distinct from an unsupported operation", async () => {
  const noMatch = { resourceType: "Parameters", parameter: [{ name: "result", valueBoolean: false }] };
  const outcome = { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-supported", diagnostics: "Map unavailable" }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(noMatch)).mockResolvedValueOnce(Response.json(outcome, { status: 422 })));
  const api = createSnowstormApiFetch();
  expect((await api({ method: "GET", path: "/ConceptMap/$translate" })).data).toEqual(noMatch);
  await expect(api({ method: "GET", path: "/ConceptMap/$translate" })).rejects.toMatchObject({ status: 422, data: { body_text: JSON.stringify(outcome), body_complete: true } });
});

it("keeps independent host instances stable even when legacy configuration changes", async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ resourceType: "CapabilityStatement" })); vi.stubGlobal("fetch", fetcher);
  const first = createSnowstormApiFetch("https://one.example/fhir");
  const second = createSnowstormApiFetch("https://two.example/fhir");
  setSnomedTxBase("https://legacy.example/fhir");
  await first({ method: "GET", path: "/metadata" });
  await second({ method: "POST", path: "/ConceptMap/$translate", body: { resourceType: "Parameters" } });
  await first({ method: "GET", path: "/CodeSystem" });
  expect(fetcher.mock.calls.map(call => new URL(call[0]).host)).toEqual(["one.example", "two.example", "one.example"]);
});

it("discovery recipe returns native capabilities and a bounded edition page without claiming completeness", async () => {
  const capability = { resourceType: "CapabilityStatement", software: { name: "fixture", version: "1" }, rest: [] };
  const terminology = { resourceType: "TerminologyCapabilities", codeSystem: [{ uri: "http://snomed.info/sct", version: [{ code: "urn:example:edition", isDefault: false }] }] };
  const editions = { resourceType: "Bundle", total: 100, link: [{ relation: "next", url: "https://fixture.example/next" }], entry: [] };
  const get = vi.fn().mockResolvedValueOnce(capability).mockResolvedValueOnce(terminology).mockResolvedValueOnce(editions);
  const result = await runInNewContext(`(async () => { ${discoveryWorkflow.code} })()`, { api: { get } });
  expect(get.mock.calls).toEqual([["/metadata"], ["/metadata", { mode: "terminology" }], ["/CodeSystem", { url: "http://snomed.info/sct", _summary: "true", _count: 20 }]]);
  expect(result).toMatchObject({ capability, terminology, editions });
  expect(result.coverage).toContain("One CodeSystem page");
});

it("catalog lets all standard mapping paths reach the adapter", () => {
  const index = buildKnownEndpointIndex(snowstormCatalog);
  for (const endpoint of mappingEndpoints) {
    expect(preflightUnknownEndpoint(endpoint.method, endpoint.path.replace("{id}", "fixture"), index)).toBeUndefined();
  }
  expect(snowstormCatalog.endpointCount).toBe(snowstormCatalog.endpoints.length);
  expect(snowstormCatalog.version).not.toContain("20250201");
});

it.each(["urn:map|2", "urn:map|1", "urn:map", undefined])("requires returned version evidence, including ignored pins: %s", async source => {
  const map = { resourceType: "ConceptMap", url: "urn:map", version: "2" };
  const native = { resourceType: "Parameters", parameter: [{ name: "result", valueBoolean: true }, { name: "match", part: source ? [{ name: "source", valueCanonical: source }] : [] }] };
  const get = vi.fn().mockResolvedValueOnce(map).mockResolvedValueOnce(native);
  const result = await runInNewContext(`(async () => { ${translationWorkflow.code} })()`, { api: { get } });
  expect(result.translation).toEqual(native);
  expect(result.version_verified).toBe(source === "urn:map|2");
  expect(result.requested.conceptMapVersion).toBe("2");
});
