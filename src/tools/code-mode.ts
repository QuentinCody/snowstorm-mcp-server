/**
 * SNOMED CT Code Mode — registers search + execute tools for the FHIR R4
 * terminology API that serves this server's SNOMED CT content.
 *
 * search: In-process catalog query, returns matching endpoints with docs.
 * execute: V8 isolate with api.get/api.post + searchSpec/listCategories.
 */

import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { snowstormCatalog } from "../spec/catalog";
import { createSnowstormApiFetch } from "../lib/api-adapter";
import { getSnomedTxBase } from "../lib/http";

interface CodeModeEnv {
	SNOWSTORM_DATA_DO: DurableObjectNamespace;
	CODE_MODE_LOADER: WorkerLoader;
}

/**
 * Register snowstorm_search and snowstorm_execute tools.
 */
export function registerCodeMode(
	server: McpServer,
	env: CodeModeEnv,
): void {
	const apiFetch = createSnowstormApiFetch();

	// Register the search tool (in-process, no isolate)
	const searchTool = createSearchTool({
		prefix: "snowstorm",
		catalog: snowstormCatalog,
	});
	searchTool.register(server as unknown as { tool: (...args: unknown[]) => void });

	// Register the execute tool (V8 isolate via DynamicWorkerExecutor)
	const executeTool = createExecuteTool({
		prefix: "snowstorm",
		// Verifiable provenance: snowstorm_execute results carry a _meta.citation.
		// The citation must name the endpoint that actually served the bytes, not
		// the terminology's publisher — these results come from HL7's reference
		// terminology server, not from SNOMED International (which blocks us).
		source: {
			id: "snowstorm",
			name: "SNOMED CT via HL7 FHIR terminology server",
			url: getSnomedTxBase(),
			license:
				"SNOMED CT is copyright (c) 2002+ International Health Terminology Standards Development Organisation (IHTSDO), distributed by agreement between IHTSDO and HL7. Implementer use of SNOMED CT is not covered by that agreement — a SNOMED CT Affiliate Licence (https://mlds.ihtsdotools.org) is required to redistribute this content.",
			version: "SNOMED CT International 20250201 (server default; override per-call with the `version` parameter)",
		},
		catalog: snowstormCatalog,
		apiFetch,
		doNamespace: env.SNOWSTORM_DATA_DO,
		loader: env.CODE_MODE_LOADER,
	});
	executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
