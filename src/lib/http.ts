/**
 * SNOMED CT terminology HTTP client (FHIR R4 terminology API).
 *
 * Default base: https://tx.fhir.org/r4 — HL7's reference terminology server.
 * It serves SNOMED CT International (20250201 at time of writing) plus 11 other
 * editions, needs no key and no registration, and Cloudflare egress reaches it.
 *
 * Why not Snowstorm any more: SNOMED International blocks our egress at its edge
 * gateway. Every request to browser.ihtsdotools.org — any path, any header, from
 * any Worker in this fleet — comes back as an HTML 405 "SNOMED International
 * Access Denied" page. That is a policy block on the caller, not a bug on our
 * side, so no header or URL change recovers it. The server therefore speaks the
 * FHIR terminology API, which is a DIFFERENT shape from the Snowstorm REST API:
 * concepts are read with CodeSystem/$lookup and searched with ValueSet/$expand.
 *
 * Alternate base (documented, NOT the default): https://r4.ontoserver.csiro.au/fhir
 * — CSIRO's Ontoserver sandbox. It answers the same operations and additionally
 * supports the implicit `?fhir_vs=ecl/...` ValueSet URL form, but it serves the
 * AU extension, so 73211009 displays as "Diabetes" rather than the International
 * "Diabetes mellitus". Point SNOMED_TX_BASE at it deliberately, never by default.
 *
 * NOTE: GET requests carry no body, so they must NOT send a `Content-Type`
 * header (non-conformant, and some WAFs reject it). Content-Type is sent only
 * on POST/with-body requests (snowstormPost), never on snowstormFetch GETs.
 */

import { restFetch, type RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

/** HL7 reference terminology server, SNOMED CT International edition. */
export const DEFAULT_SNOMED_TX_BASE = "https://tx.fhir.org/r4";

/**
 * Known keyless SNOMED CT FHIR terminology endpoints. Both were verified
 * reachable from a deployed Cloudflare Worker; neither is SLA-backed.
 */
export const KNOWN_SNOMED_TX_ENDPOINTS = [
	{
		id: "tx_fhir",
		name: "HL7 FHIR Terminology Server (tx.fhir.org)",
		url: "https://tx.fhir.org/r4",
		edition: "SNOMED CT International (900000000000207008), plus US/UK/NL/CH/DK/AT/IPS editions",
		note: "Default. Preferred display terms are International. ECL goes through the compose.include.filter constraint form — the implicit `?fhir_vs=ecl/...` URL returns 422 here.",
	},
	{
		id: "ontoserver",
		name: "CSIRO Ontoserver Sandbox (R4)",
		url: "https://r4.ontoserver.csiro.au/fhir",
		edition: "SNOMED CT AU extension (32506021000036107)",
		note: "Alternate only. Supports the implicit `?fhir_vs=ecl/...` URL form and exposes normalForm, but returns AU-preferred display terms (73211009 = 'Diabetes', not 'Diabetes mellitus').",
	},
] as const;

let snomedTxBase = DEFAULT_SNOMED_TX_BASE;

/** Set the terminology base URL at init time (from the SNOMED_TX_BASE env var). */
export function setSnomedTxBase(url: string): void {
	snomedTxBase = url.replace(/\/$/, "");
}

/** Current terminology base URL — what every request in this server targets. */
export function getSnomedTxBase(): string {
	return snomedTxBase;
}

export interface SnowstormFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
	/** Override base URL for a single call */
	baseUrl?: string;
}

/**
 * GET from the SNOMED CT FHIR terminology API with built-in retry handling.
 */
export async function snowstormFetch(
	path: string,
	params?: Record<string, unknown>,
	opts?: SnowstormFetchOptions,
): Promise<Response> {
	const baseUrl = opts?.baseUrl ?? snomedTxBase;
	// GET requests carry no body, so no Content-Type header (RFC-conformant;
	// some WAFs reject GET-with-Content-Type). Accept only.
	const headers: Record<string, string> = {
		Accept: "application/fhir+json",
		...(opts?.headers ?? {}),
	};

	return restFetch(baseUrl, path, params, {
		...opts,
		headers,
		retryOn: [429, 500, 502, 503],
		retries: opts?.retries ?? 3,
		timeout: opts?.timeout ?? 30_000,
		userAgent:
			"snowstorm-mcp-server/2.0 (bio-mcp; https://github.com/QuentinCody/snowstorm-mcp-server)",
	});
}

/**
 * POST to the terminology API — the primary search verb, because ECL reaches
 * ValueSet/$expand through a request body (`compose.include.filter`), while
 * `count`, `offset`, and `filter` stay in the query string alongside it.
 */
export async function snowstormPost(
	path: string,
	body: Record<string, unknown>,
	params?: Record<string, unknown>,
	opts?: SnowstormFetchOptions,
): Promise<Response> {
	const baseUrl = opts?.baseUrl ?? snomedTxBase;
	const headers: Record<string, string> = {
		Accept: "application/fhir+json",
		"Content-Type": "application/fhir+json",
		...(opts?.headers ?? {}),
	};

	return restFetch(baseUrl, path, params, {
		...opts,
		method: "POST",
		headers,
		body,
		retryOn: [429, 500, 502, 503],
		retries: opts?.retries ?? 3,
		timeout: opts?.timeout ?? 30_000,
		userAgent: "snowstorm-mcp-server/2.0",
	});
}
