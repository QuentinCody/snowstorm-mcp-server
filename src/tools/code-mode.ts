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
import { snowstormResponse, snowstormSource } from "../lib/tool-result";
import { DEFAULT_SNOMED_TX_BASE } from "../lib/http";

interface CodeModeEnv {
	SNOWSTORM_DATA_DO: DurableObjectNamespace;
	CODE_MODE_LOADER: WorkerLoader;
	SNOMED_TX_BASE?: string;
}

/**
 * Register snowstorm_search and snowstorm_execute tools.
 */
export function registerCodeMode(
	server: McpServer,
	env: CodeModeEnv,
): void {
	const baseUrl = (env.SNOMED_TX_BASE || DEFAULT_SNOMED_TX_BASE).replace(/\/$/, "");
	const apiFetch = createSnowstormApiFetch(baseUrl);
	const catalog = { ...snowstormCatalog, baseUrl };
	const registrar = { tool: (...args: unknown[]) => {
		const [name, ...rest] = args;
		// SAFETY: shared factories supply SDK arguments; only the alias changes.
		const register = server.tool.bind(server) as (...values: unknown[]) => void;
		const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof snowstormResponse>;
		const respond = (input: unknown, extra: unknown) => snowstormResponse(() => handler(input, extra), env, String(name), extra, input);
		register(name, ...rest, respond); register(`mcp_${String(name)}`, ...rest, respond);
	} };

	// Register the search tool (in-process, no isolate)
	const searchTool = createSearchTool({
		prefix: "snowstorm",
		catalog,
	});
	searchTool.register(registrar);

	// Register the execute tool (V8 isolate via DynamicWorkerExecutor)
	const executeTool = createExecuteTool({
		prefix: "snowstorm",
		source: snowstormSource(env),
		catalog,
		apiFetch,
		preserveApiErrors: true,
		doNamespace: env.SNOWSTORM_DATA_DO,
		loader: env.CODE_MODE_LOADER,
		maxInlineBytes: 30 * 1024,
		stagingThreshold: 30 * 1024,
		timeout: 60000,
	});
	executeTool.register(registrar);
}
