/**
 * SNOMED CT terminology catalog — FHIR R4 terminology API.
 *
 * Base URL: https://tx.fhir.org/r4 (HL7 reference terminology server).
 *
 * This is NOT the Snowstorm REST API. Every IHTSDO-operated host edge-blocks our
 * egress by policy (an HTML 405 "Access Denied" page, any path, any header), so this server
 * speaks FHIR terminology operations instead: CodeSystem/$lookup reads a concept and
 * ValueSet/$expand runs ECL. Earlier observations do not establish current host
 * support. New mapping paths are standard contracts awaiting live qualification.
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";
import { discoveryWorkflow, mappingEndpoints, translationWorkflow } from "./mapping";

const SCT = "http://snomed.info/sct";

export const snowstormCatalog: ApiCatalog = {
	name: "SNOMED CT (FHIR R4 terminology API)",
	baseUrl: "https://tx.fhir.org/r4",
	version: "FHIR R4; discover terminology editions at runtime",
	auth: "none",
	endpointCount: 14,
	notes: [
		"- Host capabilities, editions and maps are mutable. Read /metadata, /metadata?mode=terminology and /CodeSystem. Software versions and retrieval-time releaseDate values are not SNOMED content releases.",
		"- For SNOMED operations use system=http://snomed.info/sct. Preserve numeric concept IDs as strings. Use a version returned by this host and check the returned version; display terms vary by edition and version.",
		"- Read concepts with CodeSystem/$lookup and property=*. Preserve all native Parameters, repeated property/part/designation entries and Coding fields. FHIR does not expose every Snowstorm description/relationship/branch field.",
		"- For ECL POST ValueSet/$expand with a ValueSet compose.include containing system, optional version and filter [{property: constraint, op: =, value: ECL}]. Send count, offset and text filter as query parameters. Use bounded pages; retain expansion totals, timestamps, parameters and errors. Live pages are not an atomic snapshot.",
		"- ECL operators include <! direct children, >! direct parents, < descendants, > ancestors, << descendants including self, >> ancestors including self and ^ reference-set members. Counts are edition-specific; no fixed total is promised.",
		"- The default tx.fhir.org historically rejected implicit fhir_vs=ecl URLs; compose filters work in current native probes. Implicit isa/refset support and search behavior remain host-specific.",
		"- ConceptMap search/read and GET/POST translation are qualified for sampled loaded maps on both candidate hosts. This does not establish SNOMED-to-ICD-10 or all-map coverage. Select map URL, business version and source/target context explicitly.",
		"- The conceptMapVersion argument is NOT sufficient proof of a pin: tx.fhir.org returned map 101|4.0.1 for a nonexistent requested version; Ontoserver returned a native 404 for its nonexistent map version. Inspect every match.source/originMap canonical; unversioned evidence cannot confirm a map version. Retain all match equivalences, product/dependency parts, comments, result and message.",
		"- Replay Bundle link.url with relation=next via GET /__page {url: link.url}. It preserves opaque cursors within the configured service. One page or total does not prove a stable complete inventory.",
		"- Large native FHIR data stages into fhir_nodes: pointer/parent_pointer are JSON Pointers, member and ordinal preserve occurrences, kind distinguishes null/object/array/scalars, value_json preserves typed scalar values and value_text preserves strings. Root containers and empty arrays/objects remain explicit. Reconstruct by parent_pointer and ordinal; do not merge repeated Parameters or ConceptMap elements. payloads retains the complete canonical response.",
		"- HTTP failures preserve bounded native OperationOutcome evidence. result=false is a native no-match/validation answer, distinct from an HTTP error. Check staged handles and __api_error before reading native fields in recipes.",
		"- Both candidate hosts are public community/sandbox services without an assumed SLA. Preserve native copyright/licence metadata; anonymous access does not establish redistribution rights. SNOMED_TX_BASE selects the actual host for requests and citations.",
	].join("\n"),
	endpoints: [
		...mappingEndpoints,
		// === Concept ===
		{
			method: "GET",
			path: "/CodeSystem/$lookup",
			summary:
				"Read a SNOMED CT concept: display term, designations (FSN/synonyms), parents, children, module, effectiveTime, active status, and attribute relationships. Replaces Snowstorm's /MAIN/concepts/{id} AND /browser/MAIN/concepts/{id}.",
			category: "concept",
			featured: true,
			queryParams: [
				{
					name: "system",
					type: "string",
					required: true,
					description: `Code system URI — always ${SCT} for SNOMED CT`,
					default: SCT,
				},
				{
					name: "code",
					type: "string",
					required: true,
					description: "SNOMED CT concept ID (e.g. 73211009 for Diabetes mellitus)",
				},
				{
					name: "property",
					type: "string",
					required: false,
					description:
						"Which properties to return. Pass '*' for everything (designations, parent, child, module, inactive, effectiveTime, and attribute relationships keyed by attribute SCTID). Repeat the param for specific properties, e.g. property=parent&property=child.",
					default: "*",
				},
				{
					name: "version",
					type: "string",
					required: false,
					description:
						"Full SNOMED edition/version URI returned by this host's /CodeSystem discovery. If omitted, the host chooses its current default; preserve the returned version.",
				},
			],
			responseShape:
				"{ resourceType: 'Parameters', parameter: Array<{ name: 'name'|'version'|'display'|'code'|'system', valueString?: string, valueCode?: string } | { name: 'designation', part: Array<{name,valueString|valueCoding}> } | { name: 'property', part: [{name:'code',valueCode},{name:'value'|'valueString'|'valueCode'|'valueBoolean', ...}] }> }",
			example:
				"const r = await api.get('/CodeSystem/$lookup', { system: 'http://snomed.info/sct', code: '73211009', property: '*' });\n" +
				"const display = r.parameter.find(p => p.name === 'display').valueString; // 'Diabetes mellitus'\n" +
				"const children = r.parameter.filter(p => p.name === 'property' && p.part.some(x => x.name === 'code' && x.valueCode === 'child'));",
			usageHint:
				"This is the concept-read workhorse. The `property` entries are name/value part pairs — filter on part code, do not index positionally.",
		},
		{
			method: "GET",
			path: "/CodeSystem/$validate-code",
			summary:
				"Check that a SNOMED CT code exists and is valid in an edition, and get its display term. Cheaper than $lookup when you only need existence.",
			category: "concept",
			queryParams: [
				{
					name: "url",
					type: "string",
					required: true,
					description: `Code system URI — ${SCT}`,
					default: SCT,
				},
				{
					name: "code",
					type: "string",
					required: true,
					description: "SNOMED CT concept ID to validate",
				},
				{
					name: "display",
					type: "string",
					required: false,
					description: "Optional display term to check against the code (returns result=false with a message on mismatch)",
				},
				{
					name: "version",
					type: "string",
					required: false,
					description: "Full SNOMED edition/version URI to validate against",
				},
			],
			responseShape:
				"{ resourceType: 'Parameters', parameter: [{ name: 'result', valueBoolean }, { name: 'system', valueUri }, { name: 'code', valueCode }, { name: 'version', valueString }, { name: 'display', valueString }] }",
			example:
				"const r = await api.get('/CodeSystem/$validate-code', { url: 'http://snomed.info/sct', code: '73211009' });\n" +
				"const ok = r.parameter.find(p => p.name === 'result').valueBoolean; // true",
		},

		// === Search / ECL ===
		{
			method: "POST",
			path: "/ValueSet/$expand",
			summary:
				"Run an ECL expression, optionally combined with a text filter. The primary search verb — replaces Snowstorm's /MAIN/concepts?ecl=, /MAIN/concepts?term= and POST /MAIN/concepts/search.",
			category: "search",
			featured: true,
			body: {
				contentType: "application/fhir+json",
				description:
					`{"resourceType":"ValueSet","compose":{"include":[{"system":"${SCT}","filter":[{"property":"constraint","op":"=","value":"<< 73211009"}]}]}}` +
					" — add \"version\":\"<edition URI>\" inside the include object to query a non-International edition.",
			},
			queryParams: [
				{
					name: "filter",
					type: "string",
					required: false,
					description:
						"Text filter applied on top of the ECL, e.g. 'type 2'. Case-insensitive prefix matching over designations.",
				},
				{
					name: "count",
					type: "number",
					required: false,
					description: "Page size. Always set this — an unbounded ECL can match hundreds of thousands of concepts.",
					default: 50,
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset. Compare against expansion.total to know when you are done.",
				},
			],
			responseShape:
				"{ resourceType: 'ValueSet', expansion: { total?: number, offset?: number, contains?: Array<{ system: string, code: string, display: string }> } }",
			example:
				"const ecl = v => ({ resourceType: 'ValueSet', compose: { include: [{ system: 'http://snomed.info/sct', filter: [{ property: 'constraint', op: '=', value: v }] }] } });\n" +
				"// children of Diabetes mellitus containing 'type 2'\n" +
				"const r = await api.post('/ValueSet/$expand', ecl('< 73211009'), { filter: 'type 2', count: 20 });\n" +
				"const hits = r.expansion.contains; // [{code:'44054006',display:'Type 2 diabetes mellitus'}, ...]",
			usageHint:
				"The ECL goes in the BODY and count/offset/filter go in the third (params) argument. Do not put the ECL in the query string — the implicit ?fhir_vs=ecl/... URL returns 422 here.",
		},
		{
			method: "POST",
			path: "/ValueSet/$expand",
			summary:
				"Navigate the SNOMED hierarchy with ECL operators: children, parents, descendants, ancestors. Replaces Snowstorm's /concepts/{id}/children, /parents, /ancestors and /descendants paths.",
			category: "hierarchy",
			body: {
				contentType: "application/fhir+json",
				description:
					"Same ValueSet body as the search endpoint; only the ECL operator changes. `<! id` children, `>! id` parents, `< id` descendants, `> id` ancestors, `<< id` / `>> id` to include self.",
			},
			queryParams: [
				{
					name: "count",
					type: "number",
					required: false,
					description: "Page size (default 50). Descendant sets are large — 73211009 has 123.",
					default: 50,
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
			],
			example:
				"const ecl = v => ({ resourceType: 'ValueSet', compose: { include: [{ system: 'http://snomed.info/sct', filter: [{ property: 'constraint', op: '=', value: v }] }] } });\n" +
				"const kids = await api.post('/ValueSet/$expand', ecl('<! 73211009'), { count: 100 });   // 16 direct children\n" +
				"const parents = await api.post('/ValueSet/$expand', ecl('>! 73211009'), { count: 100 }); // 2 direct parents",
		},
		{
			method: "POST",
			path: "/ValueSet/$expand",
			summary:
				"Find concepts by their relationships (ECL attribute refinement). Replaces the query use of Snowstorm's /MAIN/relationships: 'which concepts have attribute TYPE pointing at TARGET'.",
			category: "relationship",
			body: {
				contentType: "application/fhir+json",
				description:
					"ValueSet body whose constraint value is a refinement, e.g. \"<< 404684003 : 363698007 = 39057004\" (clinical findings with Finding site = Pulmonary valve structure). Common attribute SCTIDs: 116680003 Is a, 363698007 Finding site, 116676008 Associated morphology, 246075003 Causative agent, 127489000 Has active ingredient.",
			},
			queryParams: [
				{
					name: "count",
					type: "number",
					required: false,
					description: "Page size",
					default: 50,
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
			],
			example:
				"const body = { resourceType: 'ValueSet', compose: { include: [{ system: 'http://snomed.info/sct', filter: [{ property: 'constraint', op: '=', value: '<< 404684003 : 363698007 = 39057004' }] }] } };\n" +
				"const r = await api.post('/ValueSet/$expand', body, { count: 10 }); // expansion.total === 101",
			usageHint:
				"Raw relationship ROWS (relationshipId, relationshipGroup, characteristicType) are not available on this API. To read one concept's own outgoing attributes, use $lookup with property='*' instead.",
		},
		{
			method: "GET",
			path: "/ValueSet/$expand",
			summary:
				"Expand an implicit SNOMED ValueSet by URL: transitive descendants (fhir_vs=isa/{id}), reference-set members (fhir_vs=refset/{id}), or the whole code system (fhir_vs) for unscoped text search.",
			category: "refset",
			queryParams: [
				{
					name: "url",
					type: "string",
					required: true,
					description:
						`Implicit ValueSet URI. '${SCT}?fhir_vs=isa/73211009' = all descendants including self (124). '${SCT}?fhir_vs=refset/723264001' = members of that reference set. '${SCT}?fhir_vs' = the entire code system — only useful with a filter, and this form returns no expansion.total.`,
				},
				{
					name: "filter",
					type: "string",
					required: false,
					description: "Text filter, e.g. 'atrial fibrillation'",
				},
				{
					name: "count",
					type: "number",
					required: false,
					description: "Page size",
					default: 50,
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
			],
			responseShape:
				"{ resourceType: 'ValueSet', name?: string, expansion: { total?: number, offset?: number, contains?: Array<{system,code,display}> } }",
			example:
				"const r = await api.get('/ValueSet/$expand', { url: 'http://snomed.info/sct?fhir_vs=refset/723264001', count: 50 });\n" +
				"const members = r.expansion.contains;",
			usageHint:
				"The ecl/ variant of this implicit URL (fhir_vs=ecl/...) returns 422 on tx.fhir.org — use POST $expand with a compose.include.filter constraint for ECL.",
		},

		// === Subsumption ===
		{
			method: "GET",
			path: "/CodeSystem/$subsumes",
			summary:
				"Test the hierarchical relationship between two SNOMED concepts without expanding anything. Returns subsumes / subsumed-by / equivalent / not-subsumed.",
			category: "hierarchy",
			queryParams: [
				{
					name: "system",
					type: "string",
					required: true,
					description: `Code system URI — ${SCT}`,
					default: SCT,
				},
				{
					name: "codeA",
					type: "string",
					required: true,
					description: "First concept ID (the candidate ancestor), e.g. 73211009",
				},
				{
					name: "codeB",
					type: "string",
					required: true,
					description: "Second concept ID (the candidate descendant), e.g. 44054006",
				},
				{
					name: "version",
					type: "string",
					required: false,
					description: "Full SNOMED edition/version URI to test against",
				},
			],
			responseShape:
				"{ resourceType: 'Parameters', parameter: [{ name: 'outcome', valueCode: 'equivalent'|'subsumes'|'subsumed-by'|'not-subsumed' }] }",
			example:
				"const r = await api.get('/CodeSystem/$subsumes', { system: 'http://snomed.info/sct', codeA: '73211009', codeB: '44054006' });\n" +
				"r.parameter[0].valueCode; // 'subsumes' — Diabetes mellitus subsumes Type 2 diabetes mellitus",
		},

		// === Editions / server capability ===
		{
			method: "GET",
			path: "/CodeSystem",
			summary:
				"List the SNOMED CT editions and versions this terminology server holds. Use the returned version URIs with the `version` parameter on $lookup / $validate-code / $subsumes.",
			category: "edition",
			queryParams: [
				{ name: "version", type: "string", required: false, description: "Filter to a specific CodeSystem business version" },
				{ name: "_count", type: "number", required: false, description: "Page size; preserve and inspect Bundle links" },
				{
					name: "url",
					type: "string",
					required: false,
					description: `Filter to SNOMED CT with ${SCT}`,
					default: SCT,
				},
				{
					name: "_summary",
					type: "string",
					required: false,
					description: "Pass 'true' to get a compact Bundle without the full CodeSystem bodies",
					enum: ["true", "false", "count"],
				},
			],
			responseShape:
				"{ resourceType: 'Bundle', total: number, entry: Array<{ resource: { resourceType: 'CodeSystem', url: string, version?: string, title?: string } }> }",
			example:
				"const r = await api.get('/CodeSystem', { url: 'http://snomed.info/sct', _summary: 'true' });\n" +
				"const versions = r.entry.map(e => e.resource.version).filter(Boolean);",
		},
		{
			method: "GET",
			path: "/metadata",
			summary:
				"Server CapabilityStatement, or TerminologyCapabilities with mode=terminology. Discover configured-host operations and edition support; declarations do not prove a particular map is loaded.",
			category: "edition",
			queryParams: [
				{ name: "mode", type: "string", required: false, description: "Use terminology for TerminologyCapabilities; omit for CapabilityStatement", enum: ["full", "normative", "terminology"] },
				{
					name: "_summary",
					type: "string",
					required: false,
					description: "Pass 'true' for the compact form",
					enum: ["true", "false"],
				},
			],
			responseShape:
				"{ resourceType: 'CapabilityStatement', fhirVersion: string, software: { name: string, version: string }, rest: [...] }",
			example:
				"const meta = await api.get('/metadata', { _summary: 'true' });\n" +
				"meta.software.name; // 'FHIRsmith' on tx.fhir.org, 'Ontoserver' on the CSIRO alternate",
		},
	],
	workflows: [
		discoveryWorkflow,
		translationWorkflow,
		{
			title: "Concept card: display, FSN, parents and children",
			description:
				"Returns a native FHIR lookup plus a convenience view of its designations and property parts. FHIR does not expose every old Snowstorm browser field.",
			keywords: ["concept", "lookup", "browser", "fsn", "parents", "children", "detail"],
			code: [
				"const SCT = 'http://snomed.info/sct';",
				"const r = await api.get('/CodeSystem/$lookup', { system: SCT, code: '73211009', property: '*' });",
				"if (r.__staged || r.__api_error) return r;",
				"const params = r.parameter || [];",
				"const scalar = n => (params.find(p => p.name === n) || {}).valueString;",
				"const propVal = p => { const v = (p.part || []).find(x => x.name !== 'code'); return v && (v.valueString ?? v.valueCode ?? v.valueBoolean ?? v.valueInteger); };",
				"const props = {};",
				"for (const p of params.filter(p => p.name === 'property')) {",
				"  const code = ((p.part || []).find(x => x.name === 'code') || {}).valueCode;",
				"  if (!code) continue;",
				"  (props[code] = props[code] || []).push(propVal(p));",
				"}",
				"const designations = params.filter(p => p.name === 'designation').map(d => ({",
				"  language: ((d.part || []).find(x => x.name === 'language') || {}).valueCode,",
				"  use: (((d.part || []).find(x => x.name === 'use') || {}).valueCoding || {}).display,",
				"  value: ((d.part || []).find(x => x.name === 'value') || {}).valueString,",
				"}));",
				"return { native: r, code: '73211009', display: scalar('display'), edition: scalar('version'), designations, parents: props.parent, children: props.child, attributes: props };",
			].join("\n"),
		},
		{
			title: "ECL search with paging (children, descendants, refinement)",
			description:
				"Reads bounded ECL pages and retains each native expansion. Stops on staged/error responses, missing totals or count limits without claiming exhaustive or atomic coverage.",
			keywords: ["ecl", "search", "expand", "paging", "descendants", "children", "refinement"],
			code: [
				"const SCT = 'http://snomed.info/sct';",
				"const eclBody = (v) => ({ resourceType: 'ValueSet', compose: { include: [{ system: SCT, filter: [{ property: 'constraint', op: '=', value: v }] }] } });",
				"async function eclAll(expression, opts = {}) {",
				"  const pageSize = opts.count || 200;",
				"  const max = opts.max || 1000;",
				"  const rows = [], pages = [];",
				"  let offset = 0, total = null;",
				"  while (rows.length < max) {",
				"    const q = { count: Math.min(pageSize, max - rows.length), offset };",
				"    if (opts.filter) q.filter = opts.filter;",
				"    const r = await api.post('/ValueSet/$expand', eclBody(expression), q);",
				"    pages.push(r);",
				"    if (r.__staged || r.__api_error) return { total, rows, pages, complete: false, next_offset: offset, reason: 'Inspect the native error or staged page before continuing.' };",
				"    const page = (r.expansion && r.expansion.contains) || [];",
				"    if (total === null) total = r.expansion && r.expansion.total;",
				"    rows.push(...page);",
				"    offset += page.length;",
				"    if (!page.length || (typeof total === 'number' && offset >= total)) break;",
				"  }",
				"  return { total, rows, pages, complete: false, observed_total_reached: typeof total === 'number' && rows.length >= total, next_offset: offset, coverage: 'Live pages are not an atomic snapshot. Check expansion versions and totals on every page.' };",
				"}",
				"// direct children of Diabetes mellitus",
				"return await eclAll('<! 73211009');",
			].join("\n"),
		},
		{
			title: "Cross-edition check: does a concept differ between editions?",
			description:
				"Reads a concept in three historically observed tx.fhir.org editions. Discover current CodeSystem versions before adapting the example; verify each returned version and retain errors/handles.",
			keywords: ["edition", "version", "us", "uk", "international", "compare"],
			code: [
				"const SCT = 'http://snomed.info/sct';",
				"const editions = {",
				"  international: 'http://snomed.info/sct/900000000000207008/version/20250201',",
				"  us: 'http://snomed.info/sct/731000124108/version/20250901',",
				"  uk: 'http://snomed.info/sct/83821000000107/version/20230412',",
				"};",
				"const out = {};",
				"for (const [name, version] of Object.entries(editions)) {",
				"  const r = await api.get('/CodeSystem/$lookup', { system: SCT, code: '73211009', version });",
				"  const p = n => (( r.parameter || []).find(x => x.name === n) || {}).valueString;",
				"  out[name] = { native: r, requested_version: version, display: p('display'), version: p('version'), version_matches: p('version') === version };",
				"}",
				"return out;",
			].join("\n"),
		},
	],
};
