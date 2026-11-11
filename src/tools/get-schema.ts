import type { McpServer } from "@bio-mcp/shared/mcp";
import { z } from "zod";
import { snowstormResponse } from "../lib/tool-result";
import { createGetSchemaHandler } from "@bio-mcp/shared/staging/utils";

interface SchemaEnv {
    SNOWSTORM_DATA_DO?: unknown;
    SNOMED_TX_BASE?: string;
}

export function registerGetSchema(server: McpServer, env?: SchemaEnv): void {
    const handler = createGetSchemaHandler("SNOWSTORM_DATA_DO", "snowstorm");

    for (const toolName of ["snowstorm_get_schema", "mcp_snowstorm_get_schema"]) server.registerTool(
        toolName,
        {
            title: "Get Staged Data Schema",
            description:
                "Get schema information for staged Snowstorm data. Shows table structures and row counts. " +
                "If called without a data_access_id, lists all staged datasets available in this session.",
            inputSchema: {
                data_access_id: z
                    .string()
                    .min(1)
                    .optional()
                    .describe(
                        "Data access ID for the staged dataset. If omitted, lists all staged datasets in this session.",
                    ),
            },
        },
        async (args, extra) => {
            const runtimeEnv =
                env || (extra as { env?: SchemaEnv })?.env || {};
            return snowstormResponse(() => handler(
                args as Record<string, unknown>,
                runtimeEnv as Record<string, unknown>,
                (extra as Record<string, unknown>),
            ), runtimeEnv, toolName, extra, args);
        },
    );
}
