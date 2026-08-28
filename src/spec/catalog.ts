/**
 * SNOMED CT terminology catalog — FHIR R4 terminology API.
 *
 * Base URL: https://tx.fhir.org/r4 (HL7 reference terminology server).
 *
 * This is NOT the Snowstorm REST API. Every IHTSDO-operated host edge-blocks our
 * egress by policy (an HTML 405 "Access Denied" page, any path, any header), so this server
 * speaks FHIR terminology operations instead: CodeSystem/$lookup reads a concept and
 * ValueSet/$expand runs ECL. Every path here was exercised live against tx.fhir.org.
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

const SCT = "http://snomed.info/sct";

export const snowstormCatalog: ApiCatalog = {
	name: "SNOMED CT (FHIR R4 terminology API)",
	baseUrl: "https://tx.fhir.org/r4",
	version: "SNOMED CT International 20250201 (FHIR R4)",
	auth: "none",
	endpointCount: 9,
	notes:
		`- The code system is always \`system=${SCT}\`. Concept IDs are SNOMED CT identifiers (numeric strings), e.g. 73211009 = Diabetes mellitus, 404684003 = Clinical finding, 138875005 = SNOMED CT Concept (root)\n` +
		"- READ A CONCEPT: `api.get('/CodeSystem/$lookup', { system, code, property: '*' })`. Returns a FHIR Parameters resource: `{ resourceType: 'Parameters', parameter: [{name,valueString|valueCode|valueBoolean}|{name:'designation',part:[...]}|{name:'property',part:[{name:'code',valueCode},{name:'value...'}]}] }`\n" +
		"- `property: '*'` is what replaces Snowstorm's /browser/ concept format. For 73211009 it returns 4 designations plus properties: parent x2, child x16, module, inactive, effectiveTime, and the concept's ATTRIBUTE relationships keyed by attribute SCTID (363698007 'Finding site' x4). There is no separate 'browser' path — pass property='*'\n" +
		"- SEARCH / ECL: `api.post('/ValueSet/$expand', body, { count, offset, filter })` where body is\n" +
		`  \`{ resourceType: 'ValueSet', compose: { include: [{ system: '${SCT}', filter: [{ property: 'constraint', op: '=', value: '<ECL>' }] }] } }\`\n` +
		"  Returns `{ resourceType: 'ValueSet', expansion: { total, offset, contains: [{system,code,display}] } }`\n" +
		"- USE THE compose.include.filter FORM, NOT the implicit URL: `?url=" + SCT + "?fhir_vs=ecl/...` returns HTTP 422 'ValueSet not found' on tx.fhir.org (it does work on the Ontoserver alternate base)\n" +
		"- ECL covers every hierarchy call the old Snowstorm paths made (verified totals for 73211009):\n" +
		"  - `<! 73211009` = direct children (16) | `>! 73211009` = direct parents (2)\n" +
		"  - `< 73211009` = descendants excl. self (123) | `> 73211009` = ancestors excl. self (8)\n" +
		"  - `<< 73211009` = descendants incl. self | `>> 73211009` = ancestors incl. self\n" +
		"  - `^ 723264001` = members of a reference set\n" +
		"  - `<< 404684003 : 363698007 = 39057004` = attribute refinement — clinical findings with Finding site = Pulmonary valve structure (101). This is what replaces Snowstorm's /MAIN/relationships search: it answers 'which concepts have relationship TYPE to TARGET', which is the query use of a relationship row\n" +
		"- TEXT SEARCH: add `filter` as a QUERY param to $expand; it combines with the ECL. `filter=type 2` over `< 73211009` gives 18 hits, first 44054006 Type 2 diabetes mellitus. For an unscoped text search use ECL `<< 138875005` (the SNOMED root) with a filter\n" +
		"- IMPLICIT VALUE SETS (GET $expand with `url`): `" + SCT + "?fhir_vs=isa/{conceptId}` (transitive descendants incl. self — 124 for 73211009), `" + SCT + "?fhir_vs=refset/{refsetId}` (reference-set members), `" + SCT + "?fhir_vs` (the whole code system; use with `filter` — note this form returns no `expansion.total`)\n" +
		"- PAGINATION: `count` and `offset` are query params on $expand. compose-based expansions return `expansion.total`; read it before assuming you have everything\n" +
		"- EDITIONS: pass `version` (a full edition URI) to $lookup / $validate-code / $subsumes, or `compose.include.version` to $expand. `system-version` is NOT supported on this build — it returns HTTP 500 'Unable to understand default system version'. GET /CodeSystem?url=" + SCT + "&_summary=true lists what the server holds: International 900000000000207008 (20250201 default, 20240201), US 731000124108 (20250901, 20240301, 20230301), UK 83821000000107 (20230412), NL 11000146104 (20240930), CH 2011000195101 (20230607), DK 554471000005108 (20260331), IPS 827022005 (20241216), and an experimental AT xsct edition\n" +
		"- Descriptions still exist, but only as `designation` entries inside a $lookup result (language + use.display, e.g. 'Fully specified name' / 'Preferred'). Semantic tags remain visible inside the FSN text, e.g. 'Diabetes mellitus (disorder)'\n" +
		"- NOT AVAILABLE on this API — do not attempt these, they were Snowstorm-only (verified against both tx.fhir.org and the Ontoserver alternate):\n" +
		"  - Description-level search (Snowstorm's description-search paths): FHIR returns concept rows, so descriptionId, per-language acceptability maps, and description-level paging are gone. Search concepts with $expand + `filter` instead\n" +
		"  - Reverse reference-set membership ('which refsets contain concept X'): no FHIR analogue. You can only expand a KNOWN refset and look for the concept in it\n" +
		"  - SNOMED to ICD-10 mapping: ConceptMap/$translate with `?fhir_cm=447562003` returns HTTP 404 on both servers. The complex-map refset's additionalFields (mapTarget/mapAdvice/mapPriority) are not exposed anywhere in this API. Do not claim an ICD-10 mapping from this server\n" +
		"  - Raw relationship rows (relationshipId, relationshipGroup, characteristicType) and Snowstorm branch/task paths\n" +
		"- Errors are FHIR OperationOutcome, not a plain body: an unknown concept gives HTTP 404 `{resourceType:'OperationOutcome',issue:[{severity:'error',code:'not-found',...}]}`\n" +
		"- Headers are handled by the server: Accept: application/fhir+json on GET (no Content-Type), Content-Type: application/fhir+json on POST\n" +
		"- LICENCE CAVEAT: these servers answer anonymous queries, but SNOMED CT content is licence-encumbered. Ontoserver's own payload states 'Implementer use of SNOMED CT is not covered by this agreement'. A SNOMED CT Affiliate Licence (free in member territories, https://mlds.ihtsdotools.org) is the correct instrument before re-serving this content to third parties\n" +
		"- The base URL is operator-settable via the SNOMED_TX_BASE worker var (default https://tx.fhir.org/r4; alternate https://r4.ontoserver.csiro.au/fhir, which serves AU-preferred display terms). Call GET /metadata if you need to confirm which server answered\n" +
		"- Neither base is SLA-backed: tx.fhir.org is HL7's community server and r4.ontoserver.csiro.au calls itself a Sandbox. Expect occasional outages",
	endpoints: [
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
						"Full SNOMED edition/version URI to read against, e.g. http://snomed.info/sct/731000124108/version/20250901 (US). Defaults to International 20250201. NOTE: the `system-version` parameter returns HTTP 500 on this server — `version` is the working name.",
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
				"Server CapabilityStatement — FHIR version, software name/version, and which terminology operations are supported. Use it to confirm which server SNOMED_TX_BASE is actually pointing at.",
			category: "edition",
			queryParams: [
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
		{
			title: "Concept card: display, FSN, parents and children",
			description:
				"One $lookup with property='*' gives everything the old /browser/MAIN/concepts/{id} path did. Parses the FHIR Parameters part-pairs into a flat object.",
			keywords: ["concept", "lookup", "browser", "fsn", "parents", "children", "detail"],
			code: [
				"const SCT = 'http://snomed.info/sct';",
				"const r = await api.get('/CodeSystem/$lookup', { system: SCT, code: '73211009', property: '*' });",
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
				"return { code: '73211009', display: scalar('display'), edition: scalar('version'), designations, parents: props.parent, children: props.child, attributes: props };",
			].join("\n"),
		},
		{
			title: "ECL search with paging (children, descendants, refinement)",
			description:
				"Pages a ValueSet/$expand until expansion.total is exhausted. Works for any ECL, including attribute refinement.",
			keywords: ["ecl", "search", "expand", "paging", "descendants", "children", "refinement"],
			code: [
				"const SCT = 'http://snomed.info/sct';",
				"const eclBody = (v) => ({ resourceType: 'ValueSet', compose: { include: [{ system: SCT, filter: [{ property: 'constraint', op: '=', value: v }] }] } });",
				"async function eclAll(expression, opts = {}) {",
				"  const pageSize = opts.count || 200;",
				"  const max = opts.max || 1000;",
				"  const rows = [];",
				"  let offset = 0, total = null;",
				"  while (rows.length < max) {",
				"    const q = { count: pageSize, offset };",
				"    if (opts.filter) q.filter = opts.filter;",
				"    const r = await api.post('/ValueSet/$expand', eclBody(expression), q);",
				"    const page = (r.expansion && r.expansion.contains) || [];",
				"    if (total === null) total = r.expansion && r.expansion.total;",
				"    rows.push(...page);",
				"    offset += page.length;",
				"    if (!page.length || (typeof total === 'number' && offset >= total)) break;",
				"  }",
				"  return { total, complete: typeof total === 'number' && rows.length >= total, rows };",
				"}",
				"// direct children of Diabetes mellitus",
				"return await eclAll('<! 73211009');",
			].join("\n"),
		},
		{
			title: "Cross-edition check: does a concept differ between editions?",
			description:
				"Reads the same concept in two editions with the `version` parameter. Use the edition URIs from GET /CodeSystem. Note `system-version` returns HTTP 500 on tx.fhir.org — `version` is the working parameter.",
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
				"  out[name] = { display: p('display'), version: p('version') };",
				"}",
				"return out;",
			].join("\n"),
		},
	],
};
