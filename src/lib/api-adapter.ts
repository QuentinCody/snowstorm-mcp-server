/**
 * SNOMED CT terminology adapter — wraps snowstormFetch/snowstormPost into the
 * ApiFetchFn interface for use by the Code Mode __api_proxy tool.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { snowstormFetch, snowstormPost } from "./http";

/**
 * Create an ApiFetchFn that routes through snowstormFetch/snowstormPost.
 * No auth needed — the FHIR terminology base is keyless.
 */
export function createSnowstormApiFetch(): ApiFetchFn {
	return async (request) => {
		let response: Response;

		if (request.method === "POST") {
			// ValueSet/$expand takes the ECL in the body and count/offset/filter in
			// the query string, so a POST must carry BOTH. Dropping request.params
			// here silently unpaginates and unfilters every ECL search.
			response = await snowstormPost(
				request.path,
				request.body as Record<string, unknown>,
				request.params,
			);
		} else {
			response = await snowstormFetch(request.path, request.params);
		}

		if (!response.ok) {
			let errorBody: string;
			try {
				errorBody = await response.text();
			} catch {
				errorBody = response.statusText;
			}
			const error = new Error(`HTTP ${response.status}: ${errorBody.slice(0, 200)}`) as Error & {
				status: number;
				data: unknown;
			};
			error.status = response.status;
			error.data = errorBody;
			throw error;
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
