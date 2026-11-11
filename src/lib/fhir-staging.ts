import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

export function fhirResource(value: unknown): Row | undefined {
  const data = object(value) && Array.isArray(value.content) && object(value.structuredContent) ? value.structuredContent.data : value;
  return object(data) && typeof data.resourceType === "string" ? data : undefined;
}

/** A positional JSON tree: preserve every FHIR field, repeated part and empty container.
 * The canonical payload is unchanged; this is only its queryable SQL projection.
 */
export function fhirTables(value: unknown): { fhir_nodes: Row[] } | undefined {
  const resource = fhirResource(value);
  if (!resource) return undefined;
  const rows: Row[] = [];
  const pending: Array<{ value: unknown; pointer: string; parent: string | null; member: string | null; ordinal: number }> = [
    { value: resource, pointer: "", parent: null, member: null, ordinal: 0 },
  ];
  while (pending.length) {
    const node = pending.pop();
    if (!node) break;
    const kind = node.value === null ? "null" : Array.isArray(node.value) ? "array" : typeof node.value;
    const children = Array.isArray(node.value) ? node.value.map((child, index) => [String(index), child] as const)
      : object(node.value) ? Object.entries(node.value) : [];
    rows.push({ node_index: rows.length, pointer: node.pointer, parent_pointer: node.parent, member: node.member,
      ordinal: node.ordinal, kind, child_count: children.length,
      value_json: kind === "object" || kind === "array" ? null : JSON.stringify(node.value),
      value_text: typeof node.value === "string" ? node.value : null });
    for (let index = children.length - 1; index >= 0; index--) {
      const [member, child] = children[index];
      const escaped = member.replace(/~/g, "~0").replace(/\//g, "~1");
      pending.push({ value: child, pointer: `${node.pointer}/${escaped}`, parent: node.pointer, member, ordinal: index });
    }
  }
  return { fhir_nodes: rows };
}

export const fhirSchemaHints: SchemaHints = { columnTypes: {
  pointer: "TEXT", parent_pointer: "TEXT", member: "TEXT", kind: "TEXT", value_json: "TEXT", value_text: "TEXT",
}, indexes: ["pointer", "parent_pointer", "member"] };
