# Snowstorm MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query **SNOMED CT** in natural language. It is one of 100+ servers in the [Bio MCP](../../README.md) monorepo.

## Which upstream this talks to

The server keeps the `snowstorm` name, but it no longer speaks the Snowstorm REST API.
SNOMED International edge-blocks our egress: every request to `browser.ihtsdotools.org`
(any path, any header, from any Worker in this fleet) returns an HTML 405
"SNOMED International Access Denied" page. That is a policy block on the caller, so no
header or URL change recovers it.

SNOMED CT content now comes from a **FHIR R4 terminology server**, keyless:

| Base | Edition | Role |
| --- | --- | --- |
| `https://tx.fhir.org/r4` | SNOMED CT International (20250201) + US/UK/NL/CH/DK/AT/IPS | **default** |
| `https://r4.ontoserver.csiro.au/fhir` | SNOMED CT AU extension | alternate — returns AU-preferred display terms (73211009 is "Diabetes", not "Diabetes mellitus") |

Set the `SNOMED_TX_BASE` worker var (see `wrangler.jsonc`) to retarget it — at a
different public server, or at a licensed/self-hosted terminology server. No code
change and no redeploy of the source is needed to switch.

### What this changes for callers

The API **shape** changed; a client that hardcoded `/MAIN/...` paths will break.

| To do this | Call |
| --- | --- |
| Read a concept (display, FSN, parents, children, attributes) | `GET /CodeSystem/$lookup?system=http://snomed.info/sct&code={id}&property=*` |
| Run ECL, with optional text filter | `POST /ValueSet/$expand` with `compose.include.filter` `{property:"constraint",op:"=",value:"<ECL>"}`, plus `?count=&offset=&filter=` |
| Children / parents / descendants / ancestors | ECL `<! id` / `>! id` / `< id` / `> id` |
| Find concepts by relationship | ECL refinement, e.g. `<< 404684003 : 363698007 = 39057004` |
| Reference-set members | `GET /ValueSet/$expand?url=http://snomed.info/sct?fhir_vs=refset/{id}` |
| Subsumption test | `GET /CodeSystem/$subsumes` |
| Pick an edition | `version=<edition URI>` (NOT `system-version`, which returns HTTP 500 on this build) |

**Gone, with no honest equivalent** — do not claim these work:

- Description-level search: FHIR returns concept rows, so `descriptionId`, per-language
  acceptability maps, and description-level paging are unavailable.
- Reverse reference-set membership ("which refsets contain concept X").
- **SNOMED to ICD-10 mapping.** `ConceptMap/$translate` with `?fhir_cm=447562003` returns
  HTTP 404 on both candidate servers, and the complex map's `mapTarget`/`mapAdvice`/
  `mapPriority` fields are not exposed anywhere in this API.
- Raw relationship rows and Snowstorm branch/task paths.

### Licence

SNOMED CT content is licence-encumbered. Both servers answer anonymous queries, but
Ontoserver's own payload states "Implementer use of SNOMED CT is not covered by this
agreement". Obtain a SNOMED CT Affiliate Licence (free in member territories,
<https://mlds.ihtsdotools.org>) before re-serving this content to third parties.

## Connect

The server is deployed and ready at:

```
https://snowstorm-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "snowstorm": {
      "command": "npx",
      "args": ["mcp-remote", "https://snowstorm-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8829/mcp` (start it with `./scripts/dev-servers.sh snowstorm`):

```json
{
  "mcpServers": {
    "snowstorm-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8829/mcp"]
    }
  }
}
```

## Tools

- `snowstorm_search` — discover available API operations (Code Mode catalog search, 9 FHIR terminology operations + 3 workflow recipes)
- `snowstorm_execute` — **Code Mode**: write JavaScript in a V8 isolate (`api.get()` / `api.post()` / `searchSpec()`) instead of issuing tool calls one by one
- `snowstorm_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `snowstorm_get_schema` — inspect the inferred schema of a staged dataset

Large responses (>30KB) are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Every tool returns both a human-readable `content` summary and a structured `structuredContent` payload.

## Development

```bash
./scripts/dev-servers.sh snowstorm            # run locally (port 8829)
pnpm --filter snowstorm-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).
