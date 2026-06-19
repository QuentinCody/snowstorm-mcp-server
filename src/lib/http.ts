/**
 * Snowstorm SNOMED CT API HTTP client.
 *
 * The IHTSDO browser endpoint is public with no auth required.
 * All requests require Accept: application/json.
 * Base URL includes /snowstorm/snomed-ct; branch paths use /MAIN.
 *
 * NOTE: GET requests carry no body, so they must NOT send a `Content-Type`
 * header (non-conformant, and some WAFs reject it). Content-Type is sent only
 * on POST/with-body requests (snowstormPost), never on snowstormFetch GETs.
 *
 * ACCESS BLOCKED (verified 2026-06): IHTSDO's public endpoints return an HTML
 * "SNOMED International Access Denied" 405 for EVERY request from our egress IP
 * (even nonexistent paths — an edge-gateway access block under SNOMED CT's
 * Browser License / Acceptable-Usage Policy, independent of headers/path). To
 * restore service, point SNOWSTORM_BASE at a self-hosted or licensed instance.
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
	// GET requests carry no body, so no Content-Type header (RFC-conformant;
	// some WAFs reject GET-with-Content-Type). Accept only.
	const headers: Record<string, string> = {
		Accept: "application/json",
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
	body: Record<string, unknown>,
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
