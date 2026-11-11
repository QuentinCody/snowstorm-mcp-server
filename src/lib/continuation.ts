/** Replay a provider Bundle link only within this configured FHIR read service. */
export function continuationPath(value: unknown, baseUrl: string): string {
  if (typeof value !== "string" || !value) throw new Error("A native Bundle continuation URL is required");
  const base = new URL(baseUrl);
  const next = new URL(value, `${baseUrl.replace(/\/$/, "")}/`);
  const root = base.pathname.replace(/\/$/, "");
  const path = next.pathname.slice(root.length);
  if (next.origin !== base.origin || next.username || next.password || next.hash || !next.pathname.startsWith(root)
    || !["", "/", "/CodeSystem", "/ConceptMap", "/ValueSet"].includes(path) || !next.search) {
    throw new Error("Continuation must be a native Bundle search link on the configured FHIR base");
  }
  return `${path || "/"}${next.search}`;
}
