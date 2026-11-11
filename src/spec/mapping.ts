import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

// FHIR R4 + Ontoserver read contracts, not proof a configured host has a map.
export const mappingEndpoints: ApiCatalog["endpoints"] = [
  {
    method: "GET", path: "/__page", category: "metadata",
    summary: "Replay an observed native Bundle continuation URL on this configured FHIR host. Preserves opaque cursor parameters; no cross-host links or resource writes. A page is not an atomic inventory.",
    queryParams: [{ name: "url", type: "string", required: true, description: "Exact link.url with relation=next from a prior native Bundle on this host" }],
  },
  {
    method: "GET", path: "/ConceptMap", category: "mapping",
    summary: "Discover ConceptMaps on the configured host. Check /metadata support first; preserve Bundle links, canonical URLs, versions, status and source/target scope. Availability is host-specific.",
    queryParams: [
      { name: "url", type: "string", required: false, description: "Exact ConceptMap canonical URL" },
      { name: "version", type: "string", required: false, description: "Map business version, distinct from source code-system version" },
      { name: "_count", type: "number", required: false, description: "Requested page size; follow Bundle links for additional results" },
    ],
  },
  {
    method: "GET", path: "/ConceptMap/$translate", category: "mapping",
    summary: "Read-only FHIR R4 translation using a known map. Host/map support must be verified; this does not establish SNOMED-to-ICD-10 coverage. Retain result, message, every match and match.equivalence/source/product; result=true does not mean all matches are equivalent.",
    queryParams: [
      { name: "url", type: "string", required: true, description: "Explicit map canonical URL selected from this host; avoid implicit text matching" },
      { name: "conceptMapVersion", type: "string", required: false, description: "Requested map version. Check returned match.source/originMap: tx.fhir.org was observed to ignore a nonexistent version; this argument alone is not a pin." },
      { name: "code", type: "string", required: true, description: "Source code, preserved as a string" },
      { name: "system", type: "string", required: true, description: "Source code-system URI" },
      { name: "version", type: "string", required: false, description: "Source code-system version" },
      { name: "source", type: "string", required: false, description: "Source ValueSet scope" },
      { name: "target", type: "string", required: false, description: "Target ValueSet scope" },
      { name: "reverse", type: "boolean", required: false, description: "Reverse direction; does not make a map bijective" },
    ],
  },
  {
    method: "POST", path: "/ConceptMap/$translate", category: "mapping",
    summary: "Read-only translation with FHIR Parameters, for Coding/CodeableConcept and dependency context. Choose an explicit map URL/version. Server support varies; preserve native Parameters and OperationOutcome without selecting a single preferred match.",
    body: { contentType: "application/fhir+json", description: "FHIR Parameters: url (valueUri), conceptMapVersion (valueString), exactly one of code/coding/codeableConcept, source/target and optional dependency parts. See FHIR R4 $translate." },
  },
  {
    method: "GET", path: "/ConceptMap/{id}", category: "mapping",
    summary: "Read an available ConceptMap by resource ID. Retain mapping direction, equivalence, comments, dependencies and product context; existence alone does not establish applicability.",
    pathParams: [{ name: "id", type: "string", required: true, description: "Resource id returned by ConceptMap discovery, not its canonical URL" }],
  },
];

export const translationWorkflow: NonNullable<ApiCatalog["workflows"]>[number] = {
  title: "Translate with native map-version evidence",
  description: "Default tx.fhir.org example: its observed v2 specimen map 102. For another host choose a discovered map and valid source code. Preserves all matches and product context; reports whether returned canonical evidence confirms the requested map version. Does not establish SNOMED-to-ICD-10 coverage.",
  keywords: ["mapping", "translation", "version", "specimen", "product"],
  code: [
    "const map = await api.get('/ConceptMap/102');",
    "if (map.__api_error || !map.url || !map.version) return { map, version_verified: false, reason: 'Map identity/version unavailable; inspect native error or staged resource.' };",
    "const requested = { url: map.url, conceptMapVersion: map.version, system: 'http://terminology.hl7.org/CodeSystem/v2-0487', code: 'ACNFLD' };",
    "const translation = await api.get('/ConceptMap/$translate', requested);",
    "const sources = (translation.parameter || []).filter(p => p.name === 'match').flatMap(p => (p.part || []).filter(q => q.name === 'source' || q.name === 'originMap').map(q => q.valueCanonical ?? q.valueUri).filter(v => typeof v === 'string'));",
    "const expected = requested.url + '|' + requested.conceptMapVersion;",
    "return { map, requested, translation, returned_map_sources: sources, version_verified: sources.length > 0 && sources.every(s => s === expected), coverage: 'Returned canonical evidence only. Retain every match equivalence, comment, dependency and product; no clinical equivalence or exhaustive mapping coverage is inferred.' };",
  ].join("\n"),
};

export const discoveryWorkflow: NonNullable<ApiCatalog["workflows"]>[number] = {
  title: "Discover this host's terminology capabilities and editions",
  description: "Returns native capability resources and one bounded CodeSystem page. No edition or translation support is inferred from the server name; check Bundle links and select an explicit version before lookup.",
  keywords: ["edition", "version", "capabilities", "metadata", "translation"],
  code: [
    "const capability = await api.get('/metadata');",
    "const terminology = await api.get('/metadata', { mode: 'terminology' });",
    "const editions = await api.get('/CodeSystem', { url: 'http://snomed.info/sct', _summary: 'true', _count: 20 });",
    "return { capability, terminology, editions, coverage: 'One CodeSystem page; inspect native Bundle links. Capability declarations do not prove a particular map is available.' };",
  ].join("\n"),
};
