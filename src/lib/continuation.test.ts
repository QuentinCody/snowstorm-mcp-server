import { afterEach, expect, it, vi } from "vitest";
import { continuationPath } from "./continuation";
import { createSnowstormApiFetch } from "./api-adapter";

afterEach(() => vi.unstubAllGlobals());
const base = "https://example.test/fhir";

it("preserves exact native opaque query encoding on same-service read links", async () => {
  const url = base + "?_getpages=opaque%2Btoken&_getpagesoffset=20&_count=20&_bundletype=searchset";
  expect(continuationPath(url, base)).toBe("/?_getpages=opaque%2Btoken&_getpagesoffset=20&_count=20&_bundletype=searchset");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ resourceType: "Bundle", entry: [] }));
  vi.stubGlobal("fetch", fetcher);
  await createSnowstormApiFetch(base)({ method: "GET", path: "/__page", params: { url } });
  expect(fetcher.mock.calls[0][0]).toBe(base + "/?_getpages=opaque%2Btoken&_getpagesoffset=20&_count=20&_bundletype=searchset");
});

it.each(["https://other.test/fhir?x=1", "https://user@example.test/fhir?x=1", base + "evil?x=1", base + "/Patient?x=1", base + "/ConceptMap/101?x=1", base + "/ConceptMap?x=1#fragment", base + "/ConceptMap", "file:///etc/passwd?x=1"])("rejects non-search continuation %s", async url => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(createSnowstormApiFetch(base)({ method: "GET", path: "/__page", params: { url } })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

it("rejects unsupported methods and GET bodies before a network request", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const api = createSnowstormApiFetch(base);
  await expect(api({ method: "DELETE", path: "/ConceptMap/101" })).rejects.toThrow();
  await expect(api({ method: "GET", path: "/metadata", body: {} })).rejects.toThrow();
  await expect(api({ method: "POST", path: "/__page", params: { url: base + "?x=1" } })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
