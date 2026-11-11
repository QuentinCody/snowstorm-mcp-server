import { expect, it } from "vitest";
import { fhirTables } from "./fhir-staging";
import map from "./fixtures/tx-map102.json";
import multiple from "./fixtures/tx-translate-102-CNJT.json";
import product from "./fixtures/tx-translate-102-ACNFLD.json";

function reconstruct(rows: Record<string, unknown>[]) {
  const nodes = new Map<string, unknown>();
  for (const row of rows) {
    const value: unknown = row.kind === "object" ? {} : row.kind === "array" ? [] : JSON.parse(String(row.value_json));
    nodes.set(String(row.pointer), value);
    if (row.parent_pointer !== null) {
      const parent = nodes.get(String(row.parent_pointer));
      if (Array.isArray(parent)) parent.push(value);
      else Object.defineProperty(parent, String(row.member), { value, enumerable: true, configurable: true });
    }
  }
  return nodes.get("");
}

for (const [name, native] of Object.entries({ map, multiple, product })) {
  it(`reconstructs every native ${name} field and repeated mapping occurrence`, () => {
    const rows = fhirTables(native)?.fhir_nodes;
    expect(rows).toBeDefined();
    expect(reconstruct(rows ?? [])).toEqual(native);
    expect(new Set(rows?.map(r => r.pointer)).size).toBe(rows?.length);
    expect(rows?.map(r => r.node_index)).toEqual(rows?.map((_, index) => index));
  });
}

it("preserves empty containers, null, typed values, leading zeros and escaped field names", () => {
  const native = { resourceType: "Parameters", "a/b~c": [null, [], {}, false, 0, "001", "", "α😀"], parameter: [{ name: "x" }, { name: "x", valueString: "second" }] };
  const rows = fhirTables(native)?.fhir_nodes ?? [];
  expect(reconstruct(rows)).toEqual(native);
  expect(rows.find(r => r.pointer === "/a~1b~0c/5")).toMatchObject({ kind: "string", value_json: '"001"', value_text: "001", member: "5", ordinal: 5 });
  expect(rows.find(r => r.pointer === "/a~1b~0c/0")).toMatchObject({ kind: "null", value_json: "null" });
  expect(rows.filter(r => r.member === "name").map(r => r.parent_pointer)).toEqual(["/parameter/0", "/parameter/1"]);
});

it("unwraps only full MCP envelopes for SQL without changing canonical input", () => {
  const original = { content: [{ type: "text", text: "native" }], structuredContent: { data: multiple } };
  expect(reconstruct(fhirTables(original)?.fhir_nodes ?? [])).toEqual(multiple);
  expect(original.structuredContent.data).toEqual(multiple);
  expect(fhirTables({ resourceType: 2 })).toBeUndefined();
  expect(fhirTables({ data: multiple })).toBeUndefined();
});
