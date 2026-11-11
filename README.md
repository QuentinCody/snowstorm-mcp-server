# Snowstorm MCP Server

This Worker keeps the `snowstorm` name and uses public **FHIR R4 terminology services**. It does not implement the Snowstorm REST API. The default is `https://tx.fhir.org/r4`; `SNOMED_TX_BASE` can select another operator-configured service, including `https://r4.ontoserver.csiro.au/fhir`. Each instance binds requests, discovery and citations to its own host.

October 5, 2026 native reads and local Worker qualification cover both candidate hosts. Earlier edge and runtime failures remain historical observations. No host was switched in production and no new backend was provisioned. SnowstormX is a separate optional backend; its release notes do not establish either current host's capabilities.

## Tools and transport

Each tool has both `snowstorm_` and `mcp_snowstorm_` aliases:

- `search`: discover 14 catalog entries (12 distinct method/path routes) and five workflow recipes.
- `execute`: run Code Mode JavaScript with `api.get`, read-only `api.post`, discovery and staging helpers.
- `query_data`: query staged results using SQL.
- `get_schema`: inspect staged tables or list session datasets.

Success and error responses contain both `content` and `structuredContent`, with verifiable citations and explicit error flags. The complete composed response stages above 30 KiB, reserving space for SDK metadata. Structured content remains below 100,000 bytes. Native HTTP failures preserve status, source URL and up to 64 KiB of decoded error-body evidence, with a hash and completeness flag. A native translation `result=false` is distinct from an HTTP failure.

## Discover the actual host

```javascript
const capability = await api.get('/metadata');
const terminology = await api.get('/metadata', { mode: 'terminology' });
const editions = await api.get('/CodeSystem', {
  url: 'http://snomed.info/sct', _summary: 'true', _count: 20
});
return { capability, terminology, editions };
```

Large resources return stage handles. Retain those handles and their full canonical payloads. A bounded CodeSystem or ConceptMap page is not an atomic inventory. Replay an observed native Bundle `link.url` with `relation: 'next'` through `api.get('/__page', { url: nextUrl })`; opaque query parameters are preserved and links must remain within the configured FHIR search service.

Software versions, generated metadata dates, map business versions and SNOMED content editions are different fields. Select an edition from this host's CodeSystem resources and check the version returned by lookup/validation. Display terms depend on the actual edition and version; a blanket International-versus-Australian display rule is not valid.

## Concepts, ECL and mappings

| Task | Operation |
| --- | --- |
| Concept, designations and properties | `GET /CodeSystem/$lookup` with `system`, `code`, `version`, `property: '*'` |
| Validation | `GET /CodeSystem/$validate-code` |
| Subsumption | `GET /CodeSystem/$subsumes` |
| ECL expansion | `POST /ValueSet/$expand`, with ECL in `compose.include.filter` and `count`, `offset`, `filter` in query parameters |
| Map discovery/read | `GET /ConceptMap`, `GET /ConceptMap/{id}` |
| Translation | `GET` or read-only `POST /ConceptMap/$translate` |

FHIR concept results do not provide all former Snowstorm description IDs, raw relationship rows, branch/task operations or reverse reference-set membership. ECL expansion counts and paging depend on the source edition; preserve each native page and its parameters. Native language defaults can differ between HTTP clients, so compare request context along with results.

Choose a loaded map's canonical URL, business version and source/target scope. Preserve every match, equivalence, source/target Coding, comment, dependency and product. `result=true` does not make every match equivalent, and reverse translation does not imply an invertible map.

**A requested map version is not proof of a pin.** The October 5 tx.fhir.org probe returned `http://hl7.org/fhir/ConceptMap/101|4.0.1` for a nonexistent requested version. Ontoserver returned an explicit native 404 for a nonexistent version of its sampled state map. The translation recipe checks returned `source`/`originMap` canonical evidence; absent or unversioned evidence cannot confirm a version. Its specimen-map example applies to the observed default host and is not a claim of SNOMED-to-ICD-10 coverage or clinical applicability.

## Lossless FHIR SQL projection

Staged native FHIR resources expose `fhir_nodes`, one row per JSON node:

- `pointer` and `parent_pointer`: JSON Pointer identity and parent relationship.
- `member`, `ordinal`, `node_index`: field or array position and source traversal order.
- `kind`, `child_count`: scalar/container type, including explicit empty objects/arrays and nulls.
- `value_json`: typed scalar JSON; `value_text`: exact strings, including leading zeros.

Join through parent pointers and preserve ordinal positions. Repeated `Parameters.part`, map elements, target matches and Coding fields must not be merged by name. The `payloads` table retains the complete canonical resource; SQL projection does not rewrite it. Very large text cells may use `content_chunks`, as shown by the returned schema.

For example, find all occurrences of a source code while retaining their parent identities:

```sql
SELECT pointer, parent_pointer, value_text
FROM fhir_nodes
WHERE member = 'code' AND value_text = 'CNJT'
ORDER BY node_index;
```

Preserve native copyright and licence metadata. Anonymous terminology access does not establish redistribution rights. [FHIR R4 translation semantics](https://hl7.org/fhir/R4/conceptmap-operation-translate.html) and [Ontoserver map documentation](https://ontoserver.csiro.au/docs/6.18.4/api-fhir-conceptmap.html) describe the operation contracts; actual loaded content remains host-specific.

## Development

```bash
./scripts/dev-servers.sh snowstorm
pnpm --filter snowstorm-mcp-server run type-check
pnpm exec vitest run servers/snowstorm-mcp-server
node scripts/verify-server.mjs snowstorm --url http://127.0.0.1:8829/mcp --json
```

The configured production MCP URL is `https://snowstorm-mcp-server.quentincody.workers.dev/mcp`. Local acceptance does not establish deployment of these changes. Detailed evidence is in [the October 5 review](../../docs/audits/2026-10-05-snowstorm-review.md).

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from SNOMED CT via FHIR terminology server and stays under the terms of that source: SNOMED CT affiliate license.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
