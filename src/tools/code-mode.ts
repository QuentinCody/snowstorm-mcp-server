/**
 * Snowstorm Code Mode — registers search + execute tools for full SNOMED CT API access.
 *
 * search: In-process catalog query, returns matching endpoints with docs.
 * execute: V8 isolate with api.get/api.post + searchSpec/listCategories.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { snowstormCatalog } from "../spec/catalog";
import { createSnowstormApiFetch } from "../lib/api-adapter";

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
) {
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
		catalog: snowstormCatalog,
		apiFetch,
		doNamespace: env.SNOWSTORM_DATA_DO,
		loader: env.CODE_MODE_LOADER,
	});
	executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
