import { buildHealthResponse, configureCitationSigning } from "@bio-mcp/shared";
import { StatelessMcpWorker } from "@bio-mcp/shared/mcp";
import { McpServer } from "@bio-mcp/shared/mcp";
import { registerQueryData } from "./tools/query-data";
import { registerGetSchema } from "./tools/get-schema";
import { registerCodeMode } from "./tools/code-mode";
import { setSnomedTxBase } from "./lib/http";
import { SnowstormDataDO } from "./do";

// Export Durable Object classes
export { SnowstormDataDO };

interface SnowstormEnv {
    SNOWSTORM_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
    /**
     * SNOMED CT FHIR terminology base URL. Defaults to https://tx.fhir.org/r4
     * (see src/lib/http.ts). Set it to https://r4.ontoserver.csiro.au/fhir to
     * query the AU extension, or to a licensed/self-hosted terminology server.
     */
    SNOMED_TX_BASE?: string;
}

export class MyMCP extends StatelessMcpWorker {
    server = new McpServer({
        name: "snowstorm",
        version: "0.1.0",
    });

    async init() {

    	configureCitationSigning(this.env);
        const env = this.env as unknown as SnowstormEnv;

        // Terminology base is operable without a code change (wrangler var or secret)
        if (env.SNOMED_TX_BASE) {
            setSnomedTxBase(env.SNOMED_TX_BASE);
        }

        registerQueryData(this.server, env);
        registerGetSchema(this.server, env);
        registerCodeMode(this.server, env);
    }
}

export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        if (url.pathname === "/health") {
            return buildHealthResponse("snowstorm");
        }

        if (url.pathname === "/readyz") {
            // Deep check: builds the MCP server the way a real request does, so a
            // factory that throws is a 503 here instead of a green /health over a
            // server that 500s every MCP call.
            return MyMCP.readiness(env, "snowstorm");
        }

        if (url.pathname === "/mcp") {
            return MyMCP.serve("/mcp").fetch(request, env, ctx);
        }

        return new Response("Not found", { status: 404 });
    },
};
