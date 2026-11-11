/**
 * SNOMED CT terminology adapter — wraps snowstormFetch/snowstormPost into the
 * ApiFetchFn interface for use by the Code Mode __api_proxy tool.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { getSnomedTxBase, snowstormFetch, snowstormPost } from "./http";
import { nativeError } from "./native-error";
import { continuationPath } from "./continuation";

/**
 * Create an ApiFetchFn that routes through snowstormFetch/snowstormPost.
 * No auth needed — the FHIR terminology base is keyless.
 */
export function createSnowstormApiFetch(baseUrl = getSnomedTxBase()): ApiFetchFn {
	return async (request) => {
		let response: Response;
		if (request.method !== "GET" && request.method !== "POST") throw new Error("Only documented GET and read-only POST operations are supported");
		if (request.method === "GET" && request.body !== undefined) throw new Error("GET requests must not carry a body");
		const path = request.path === "/__page" ? continuationPath(request.params?.url, baseUrl) : request.path;
		if (request.path === "/__page" && request.method !== "GET") throw new Error("Bundle continuation supports GET only");
		const params = request.path === "/__page" ? undefined : request.params;

		if (request.method === "POST") {
			// ValueSet/$expand takes the ECL in the body and count/offset/filter in
			// the query string, so a POST must carry BOTH. Dropping request.params
			// here silently unpaginates and unfilters every ECL search.
			response = await snowstormPost(
				path,
				request.body as Record<string, unknown>,
				request.params,
				{ baseUrl },
			);
		} else {
			response = await snowstormFetch(path, params, { baseUrl });
		}

		if (!response.ok) {
			throw await nativeError(response, response.url || `${baseUrl}${path}`);
		}

		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("json")) {
			const text = await response.text();
			return { status: response.status, data: text };
		}

		const data = await response.json();
		return { status: response.status, data };
	};
}
