import { afterEach, describe, expect, it, vi } from "vitest";
import { createSnowstormApiFetch } from "./api-adapter";
import { DEFAULT_SNOMED_TX_BASE, setSnomedTxBase } from "./http";

const SCT = "http://snomed.info/sct";

/** Capture the single fetch this server makes, and answer it with a FHIR body. */
function captureFetch(body: unknown = { resourceType: "Parameters", parameter: [] }) {
	const spy = vi.fn(async () =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { "content-type": "application/fhir+json" },
		}),
	);
	vi.stubGlobal("fetch", spy);
	return spy;
}

function callOf(spy: ReturnType<typeof captureFetch>) {
	const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
	return { url: new URL(url), headers: (init.headers ?? {}) as Record<string, string>, init };
}

afterEach(() => {
	vi.unstubAllGlobals();
	setSnomedTxBase(DEFAULT_SNOMED_TX_BASE);
});

describe("SNOMED CT terminology base", () => {
	// SNOMED International edge-blocks our egress: every request to any
	// ihtsdotools host comes back as an HTML 405 "Access Denied" page, from any
	// Worker in the fleet. Pointing back at it is a silent, total outage.
	it("never targets a blocked SNOMED International host by default", async () => {
		const spy = captureFetch();
		await createSnowstormApiFetch()({
			method: "GET",
			path: "/CodeSystem/$lookup",
			params: { system: SCT, code: "73211009" },
		});
		const { url } = callOf(spy);
		expect(url.hostname).not.toMatch(/ihtsdotools\.org$/);
		expect(url.origin + url.pathname).toBe("https://tx.fhir.org/r4/CodeSystem/$lookup");
	});

	// The comments used to advertise a "SNOWSTORM_BASE override" that did not
	// exist — the base was a module constant. index.ts now feeds SNOMED_TX_BASE
	// through setSnomedTxBase, so a redeploy is not needed to retarget.
	it("honours a runtime base override, trailing slash and all", async () => {
		setSnomedTxBase("https://r4.ontoserver.csiro.au/fhir/");
		const spy = captureFetch();
		await createSnowstormApiFetch()({
			method: "GET",
			path: "/CodeSystem/$subsumes",
			params: { system: SCT, codeA: "73211009", codeB: "44054006" },
		});
		expect(callOf(spy).url.href.startsWith("https://r4.ontoserver.csiro.au/fhir/CodeSystem/$subsumes?")).toBe(true);
	});
});

describe("FHIR content negotiation", () => {
	it("sends Accept: application/fhir+json and no Content-Type on a GET", async () => {
		const spy = captureFetch();
		await createSnowstormApiFetch()({
			method: "GET",
			path: "/CodeSystem/$lookup",
			params: { system: SCT, code: "73211009", property: "*" },
		});
		const { headers, url } = callOf(spy);
		expect(headers.Accept).toBe("application/fhir+json");
		expect(headers["Content-Type"]).toBeUndefined();
		expect(url.searchParams.get("system")).toBe(SCT);
		expect(url.searchParams.get("property")).toBe("*");
	});

	it("sends Content-Type: application/fhir+json with the ECL body on a POST", async () => {
		const spy = captureFetch({ resourceType: "ValueSet", expansion: { total: 16, contains: [] } });
		const body = {
			resourceType: "ValueSet",
			compose: { include: [{ system: SCT, filter: [{ property: "constraint", op: "=", value: "<! 73211009" }] }] },
		};
		await createSnowstormApiFetch()({ method: "POST", path: "/ValueSet/$expand", body });
		const { headers, init } = callOf(spy);
		expect(headers["Content-Type"]).toBe("application/fhir+json");
		expect(headers.Accept).toBe("application/fhir+json");
		expect(JSON.parse(init.body as string)).toEqual(body);
	});
});

describe("ValueSet/$expand query params", () => {
	// ECL travels in the POST BODY while count/offset/filter stay in the query
	// string. The adapter used to drop request.params on the POST branch, which
	// silently unpaginated and unfiltered every ECL search — the response still
	// looked well-formed, just truncated to the server default.
	it("forwards count, offset and filter alongside the POST body", async () => {
		const spy = captureFetch({ resourceType: "ValueSet", expansion: { total: 18, contains: [] } });
		await createSnowstormApiFetch()({
			method: "POST",
			path: "/ValueSet/$expand",
			params: { count: 200, offset: 400, filter: "type 2" },
			body: {
				resourceType: "ValueSet",
				compose: { include: [{ system: SCT, filter: [{ property: "constraint", op: "=", value: "< 73211009" }] }] },
			},
		});
		const { url } = callOf(spy);
		expect(url.searchParams.get("count")).toBe("200");
		expect(url.searchParams.get("offset")).toBe("400");
		expect(url.searchParams.get("filter")).toBe("type 2");
	});
});

describe("upstream errors stay errors", () => {
	// A FHIR OperationOutcome must surface as a thrown error, never as a
	// success envelope the model would read as "no such concept exists".
	it("throws on a 404 OperationOutcome instead of returning it as data", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found" }] }),
					{ status: 404, headers: { "content-type": "application/fhir+json" } },
				),
			),
		);
		await expect(
			createSnowstormApiFetch()({
				method: "GET",
				path: "/CodeSystem/$lookup",
				params: { system: SCT, code: "99999999999" },
			}),
		).rejects.toThrow(/HTTP 404/);
	});
});
