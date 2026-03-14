/**
 * Snowstorm SNOMED CT API catalog — hand-built from IHTSDO Snowstorm docs.
 *
 * Covers ~20 endpoints across 7 categories: concept, description, relationship,
 * hierarchy, refset, mapping, and ecl.
 *
 * Base URL: https://browser.ihtsdotools.org/snowstorm/snomed-ct
 * All queries use branch /MAIN (International Edition).
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const snowstormCatalog: ApiCatalog = {
	name: "Snowstorm SNOMED CT",
	baseUrl: "https://browser.ihtsdotools.org/snowstorm/snomed-ct",
	version: "9.0",
	auth: "none",
	endpointCount: 18,
	notes:
		"- Branch: all queries are against /MAIN (SNOMED CT International Edition)\n" +
		"- Concept IDs are SNOMED CT identifiers (numeric strings), e.g. 73211009 = Diabetes mellitus, 404684003 = Clinical finding\n" +
		"- ECL (Expression Constraint Language) enables powerful hierarchy queries:\n" +
		"  - `<< 404684003` = all descendants of Clinical finding (including self)\n" +
		"  - `< 73211009 |Diabetes mellitus|` = children of diabetes (excluding self)\n" +
		"  - `>> 404684003` = all ancestors of Clinical finding (including self)\n" +
		"  - `> 73211009` = parents of diabetes (excluding self)\n" +
		"  - `^ 447562003` = members of the ICD-10 complex map refset\n" +
		"  - `<< 404684003 : 363698007 = << 39057004` = clinical findings with finding site in structure of cerebral hemisphere\n" +
		"- Descriptions have types: FSN (Fully Specified Name, includes semantic tag) and SYNONYM (Preferred Term is the preferred synonym)\n" +
		"- Semantic tags in FSN indicate concept type: (disorder), (finding), (procedure), (substance), (body structure), (observable entity), (morphologic abnormality), (organism), (product), (qualifier value), (situation), (event), (physical object), (specimen), (environment), (cell structure), (cell), (link assertion), (regime/therapy)\n" +
		"- Relationships use SNOMED CT type IDs, e.g. 116680003 = 'Is a' (parent), 363698007 = 'Finding site', 116676008 = 'Associated morphology'\n" +
		"- ICD-10 cross-mappings: query refset members with refsetId=447562003 (ICD-10 complex map) or refsetId=816186008 (ICD-10-CM simple map)\n" +
		"- Pagination: most list endpoints return { items, total, limit, offset }. Use offset + limit params (default limit=50, max 10000)\n" +
		"- The /browser/ prefix endpoints return enriched concept data with pt (preferred term), fsn (fully specified name), and descriptions pre-populated\n" +
		"- Accept: application/json header is required on all requests\n" +
		"- Rate limits: the public browser endpoint has moderate rate limits; add delays for bulk queries",
	endpoints: [
		// === Concept ===
		{
			method: "GET",
			path: "/browser/MAIN/concepts/{conceptId}",
			summary:
				"Get a concept in browser format with FSN, PT, descriptions, and relationships pre-populated",
			category: "concept",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "SNOMED CT concept ID (e.g. 73211009 for Diabetes mellitus)",
				},
			],
			queryParams: [],
		},
		{
			method: "GET",
			path: "/MAIN/concepts/{conceptId}",
			summary: "Get a concept by SNOMED CT concept ID (minimal format)",
			category: "concept",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "SNOMED CT concept ID (e.g. 73211009)",
				},
			],
			queryParams: [],
		},
		{
			method: "GET",
			path: "/MAIN/concepts",
			summary:
				"Search concepts by term string or ECL expression. Returns paginated results with items array.",
			category: "concept",
			queryParams: [
				{
					name: "term",
					type: "string",
					required: false,
					description: "Search term (e.g. 'diabetes', 'heart failure'). Matches against descriptions.",
				},
				{
					name: "ecl",
					type: "string",
					required: false,
					description:
						"ECL (Expression Constraint Language) query. E.g. '<< 404684003' for descendants of Clinical finding.",
				},
				{
					name: "activeFilter",
					type: "boolean",
					required: false,
					description: "Filter by active status (default: true)",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset (default: 0)",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results to return (default: 50, max: 10000)",
				},
				{
					name: "definitionStatusFilter",
					type: "string",
					required: false,
					description:
						"Filter by definition status",
					enum: ["PRIMITIVE", "FULLY_DEFINED"],
				},
				{
					name: "module",
					type: "string",
					required: false,
					description: "Filter by module SCTID (e.g. 900000000000207008 for core module)",
				},
			],
		},
		{
			method: "POST",
			path: "/MAIN/concepts/search",
			summary:
				"Advanced concept search with ECL, term filters, and semantic tag filters via POST body",
			category: "ecl",
			body: {
				contentType: "application/json",
				description:
					'{"termFilter": {"term": "diabetes"}, "eclFilter": "<< 404684003", "activeFilter": true, "limit": 50, "offset": 0}',
			},
		},

		// === Description ===
		{
			method: "GET",
			path: "/MAIN/descriptions",
			summary:
				"Search descriptions (terms) across all concepts. Returns descriptions with conceptId, term, type, and language.",
			category: "description",
			queryParams: [
				{
					name: "term",
					type: "string",
					required: false,
					description: "Search term to match against description text",
				},
				{
					name: "active",
					type: "boolean",
					required: false,
					description: "Filter by active status",
				},
				{
					name: "conceptActive",
					type: "boolean",
					required: false,
					description: "Filter by whether the parent concept is active",
				},
				{
					name: "module",
					type: "string",
					required: false,
					description: "Filter by module SCTID",
				},
				{
					name: "language",
					type: "string",
					required: false,
					description: "Filter by language code (e.g. 'en')",
				},
				{
					name: "type",
					type: "string",
					required: false,
					description: "Filter by description type SCTID: 900000000000003001=FSN, 900000000000013009=Synonym",
				},
				{
					name: "semanticTag",
					type: "string",
					required: false,
					description:
						"Filter by semantic tag (e.g. 'disorder', 'finding', 'procedure')",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50, max: 10000)",
				},
			],
		},
		{
			method: "GET",
			path: "/browser/MAIN/descriptions",
			summary:
				"Search descriptions in browser format. Returns descriptions with concept details (FSN, PT) included.",
			category: "description",
			queryParams: [
				{
					name: "term",
					type: "string",
					required: true,
					description: "Search term",
				},
				{
					name: "active",
					type: "boolean",
					required: false,
					description: "Filter active descriptions only",
				},
				{
					name: "conceptActive",
					type: "boolean",
					required: false,
					description: "Filter by concept active status",
				},
				{
					name: "semanticTag",
					type: "string",
					required: false,
					description: "Filter by semantic tag (e.g. 'disorder')",
				},
				{
					name: "language",
					type: "string",
					required: false,
					description: "Language code (e.g. 'en')",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50)",
				},
			],
		},

		// === Hierarchy ===
		{
			method: "GET",
			path: "/browser/MAIN/concepts/{conceptId}/children",
			summary:
				"Get direct children of a concept in browser format (with PT, FSN). Useful for hierarchy navigation.",
			category: "hierarchy",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "Parent concept ID",
				},
			],
			queryParams: [
				{
					name: "form",
					type: "string",
					required: false,
					description: "Relationship form",
					enum: ["stated", "inferred"],
					default: "inferred",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50)",
				},
			],
		},
		{
			method: "GET",
			path: "/MAIN/concepts/{conceptId}/parents",
			summary: "Get direct parents (Is-a targets) of a concept",
			category: "hierarchy",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "Child concept ID",
				},
			],
			queryParams: [
				{
					name: "form",
					type: "string",
					required: false,
					description: "Relationship form",
					enum: ["stated", "inferred"],
					default: "inferred",
				},
			],
		},
		{
			method: "GET",
			path: "/browser/MAIN/concepts/{conceptId}/parents",
			summary: "Get direct parents of a concept in browser format (with PT, FSN)",
			category: "hierarchy",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "Child concept ID",
				},
			],
			queryParams: [
				{
					name: "form",
					type: "string",
					required: false,
					description: "Relationship form",
					enum: ["stated", "inferred"],
					default: "inferred",
				},
			],
		},
		{
			method: "GET",
			path: "/browser/MAIN/concepts/{conceptId}/ancestors",
			summary:
				"Get all ancestors (transitive parents) of a concept. Warning: can return large result sets for deep hierarchies.",
			category: "hierarchy",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "Concept ID",
				},
			],
			queryParams: [
				{
					name: "form",
					type: "string",
					required: false,
					description: "Relationship form",
					enum: ["stated", "inferred"],
					default: "inferred",
				},
			],
		},
		{
			method: "GET",
			path: "/MAIN/concepts/{conceptId}/descendants",
			summary:
				"Get all descendants (transitive children) of a concept. Use with limit to avoid huge responses. Returns { items, total, offset, limit }.",
			category: "hierarchy",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "Concept ID",
				},
			],
			queryParams: [
				{
					name: "stated",
					type: "boolean",
					required: false,
					description: "Use stated relationships (default: false = inferred)",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50). Use a small limit as descendants can be very numerous.",
				},
			],
		},

		// === Relationship ===
		{
			method: "GET",
			path: "/browser/MAIN/concepts/{conceptId}/parents",
			summary:
				"Get inferred/stated parents for a concept (browser format with enriched details)",
			category: "relationship",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "Concept ID",
				},
			],
			queryParams: [
				{
					name: "form",
					type: "string",
					required: false,
					description: "Relationship form",
					enum: ["stated", "inferred"],
					default: "inferred",
				},
			],
		},
		{
			method: "GET",
			path: "/MAIN/relationships",
			summary:
				"Search relationships by source, destination, or type. Returns paginated relationship records.",
			category: "relationship",
			queryParams: [
				{
					name: "source",
					type: "string",
					required: false,
					description: "Source concept ID (the concept that has the relationship)",
				},
				{
					name: "destination",
					type: "string",
					required: false,
					description: "Destination concept ID (the target of the relationship)",
				},
				{
					name: "type",
					type: "string",
					required: false,
					description:
						"Relationship type SCTID. Common: 116680003=Is a, 363698007=Finding site, 116676008=Associated morphology",
				},
				{
					name: "active",
					type: "boolean",
					required: false,
					description: "Filter by active status",
				},
				{
					name: "characteristicType",
					type: "string",
					required: false,
					description: "Filter by characteristic type",
					enum: ["STATED_RELATIONSHIP", "INFERRED_RELATIONSHIP"],
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50)",
				},
			],
		},

		// === Reference Set (Refset) ===
		{
			method: "GET",
			path: "/MAIN/members",
			summary:
				"Search reference set members. Use refsetId to query specific refsets (e.g. ICD-10 map, language refsets).",
			category: "refset",
			queryParams: [
				{
					name: "referenceSet",
					type: "string",
					required: false,
					description:
						"Refset concept ID. E.g. 447562003=ICD-10 complex map, 816186008=ICD-10-CM simple map, 900000000000509007=US English language refset",
				},
				{
					name: "referencedComponentId",
					type: "string",
					required: false,
					description: "SCTID of the referenced component (concept, description, or relationship)",
				},
				{
					name: "active",
					type: "boolean",
					required: false,
					description: "Filter by active status",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50)",
				},
			],
		},
		{
			method: "GET",
			path: "/MAIN/concepts/{conceptId}/members",
			summary:
				"Get reference set members for a specific concept (all refsets the concept belongs to, or all members of a concept-based refset).",
			category: "refset",
			pathParams: [
				{
					name: "conceptId",
					type: "string",
					required: true,
					description: "Concept ID to get refset memberships for",
				},
			],
			queryParams: [
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50)",
				},
			],
		},

		// === Mapping (SNOMED to ICD-10) ===
		{
			method: "GET",
			path: "/MAIN/members",
			summary:
				"Get ICD-10 mappings for a SNOMED concept. Query with referenceSet=447562003 (ICD-10 complex map) and referencedComponentId={conceptId}.",
			category: "mapping",
			queryParams: [
				{
					name: "referenceSet",
					type: "string",
					required: true,
					description:
						"Set to 447562003 for ICD-10 complex map or 816186008 for ICD-10-CM simple map",
				},
				{
					name: "referencedComponentId",
					type: "string",
					required: true,
					description: "SNOMED CT concept ID to find ICD-10 mapping for",
				},
				{
					name: "active",
					type: "boolean",
					required: false,
					description: "Filter by active status (default: true)",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50)",
				},
			],
		},

		// === ECL (Expression Constraint Language) ===
		{
			method: "GET",
			path: "/MAIN/concepts",
			summary:
				"Execute ECL query via GET. Pass ECL expression as the 'ecl' query parameter. Returns paginated concept results.",
			category: "ecl",
			queryParams: [
				{
					name: "ecl",
					type: "string",
					required: true,
					description:
						"ECL expression. Examples: '<< 73211009' (all types of diabetes), '< 404684003 : 363698007 = << 39057004' (clinical findings with finding site in cerebral hemisphere)",
				},
				{
					name: "term",
					type: "string",
					required: false,
					description: "Additional term filter to combine with ECL",
				},
				{
					name: "activeFilter",
					type: "boolean",
					required: false,
					description: "Filter by active status",
				},
				{
					name: "offset",
					type: "number",
					required: false,
					description: "Pagination offset",
				},
				{
					name: "limit",
					type: "number",
					required: false,
					description: "Number of results (default: 50, max: 10000)",
				},
			],
		},
		{
			method: "POST",
			path: "/MAIN/concepts/search",
			summary:
				"Execute advanced ECL search via POST with complex filters. Supports combined ECL + term + semantic tag filtering.",
			category: "ecl",
			body: {
				contentType: "application/json",
				description:
					'{"eclFilter": "<< 73211009", "termFilter": {"term": "type 2"}, "activeFilter": true, "returnIdOnly": false, "offset": 0, "limit": 50}',
			},
		},
	],
};
