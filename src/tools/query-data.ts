import type { McpServer } from "@bio-mcp/shared/mcp";
import { z } from "zod";
import { snowstormResponse } from "../lib/tool-result";
import { createQueryDataHandler } from "@bio-mcp/shared/staging/utils";

interface QueryEnv {
    SNOWSTORM_DATA_DO?: unknown;
    SNOMED_TX_BASE?: string;
}

export function registerQueryData(server: McpServer, env?: QueryEnv): void {
    const handler = createQueryDataHandler("SNOWSTORM_DATA_DO", "snowstorm");

    for (const toolName of ["snowstorm_query_data", "mcp_snowstorm_query_data"]) server.registerTool(
        toolName,
        {
            title: "Query Staged Snowstorm Data",
            description:
                "Query staged Snowstorm data using SQL. Use this when responses are too large and have been staged with a data_access_id.",
            inputSchema: {
                data_access_id: z
                    .string()
                    .min(1)
                    .describe("Data access ID for the staged dataset"),
                sql: z
                    .string()
                    .min(1)
                    .describe("SQL query to execute against the staged data"),
                limit: z
                    .number()
                    .int()
                    .positive()
                    .max(10000)
                    .optional()
                    .describe("Maximum number of rows to return (default: 100)"),
            },
        },
        async (args, extra) => {
            const runtimeEnv =
                env || (extra as { env?: QueryEnv })?.env || {};
            return snowstormResponse(() => handler(
                args as Record<string, unknown>,
                runtimeEnv as Record<string, unknown>,
            ), runtimeEnv, toolName, extra, args);
        },
    );
}
