/**
 * Snowstorm SNOMED CT API HTTP client.
 *
 * The IHTSDO browser endpoint is public with no auth required.
 * All requests require Accept: application/json.
 * Base URL includes /snowstorm/snomed-ct; branch paths use /MAIN.
 */

import { restFetch, type RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const SNOWSTORM_BASE = "https://browser.ihtsdotools.org/snowstorm/snomed-ct";

export interface SnowstormFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
	/** Override base URL */
	baseUrl?: string;
}

/**
 * Fetch from the Snowstorm SNOMED CT API with built-in retry handling.
 */
export async function snowstormFetch(
	path: string,
	params?: Record<string, unknown>,
	opts?: SnowstormFetchOptions,
): Promise<Response> {
	const baseUrl = opts?.baseUrl ?? SNOWSTORM_BASE;
	const headers: Record<string, string> = {
		Accept: "application/json",
		"Content-Type": "application/json",
		...(opts?.headers ?? {}),
	};

	return restFetch(baseUrl, path, params, {
		...opts,
		headers,
		retryOn: [429, 500, 502, 503],
		retries: opts?.retries ?? 3,
		timeout: opts?.timeout ?? 30_000,
		userAgent:
			"snowstorm-mcp-server/1.0 (bio-mcp; https://github.com/QuentinCody/snowstorm-mcp-server)",
	});
}

/**
 * POST to the Snowstorm API (for ECL search and batch operations).
 */
export async function snowstormPost(
	path: string,
	body: object,
	opts?: SnowstormFetchOptions,
): Promise<Response> {
	const baseUrl = opts?.baseUrl ?? SNOWSTORM_BASE;
	const headers: Record<string, string> = {
		Accept: "application/json",
		"Content-Type": "application/json",
		...(opts?.headers ?? {}),
	};

	return restFetch(baseUrl, path, undefined, {
		...opts,
		method: "POST",
		headers,
		body,
		retryOn: [429, 500, 502, 503],
		retries: opts?.retries ?? 3,
		timeout: opts?.timeout ?? 30_000,
		userAgent: "snowstorm-mcp-server/1.0",
	});
}
