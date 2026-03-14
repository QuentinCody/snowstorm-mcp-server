/**
 * SnowstormDataDO — Durable Object for staging large Snowstorm SNOMED CT responses.
 *
 * Extends RestStagingDO with schema hints for concepts, descriptions,
 * relationships, and reference set members.
 */

import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class SnowstormDataDO extends RestStagingDO {
	protected getSchemaHints(data: unknown): SchemaHints | undefined {
		if (!data || typeof data !== "object") return undefined;

		const obj = data as Record<string, unknown>;

		// Concept search results — { items: [...], total, limit, offset }
		if (Array.isArray(obj.items)) {
			const sample = obj.items[0];
			if (sample && typeof sample === "object") {
				const s = sample as Record<string, unknown>;

				// Concept items (have conceptId and fsn)
				if ("conceptId" in s && "fsn" in s) {
					return {
						tableName: "concepts",
						indexes: ["conceptId", "active", "moduleId", "definitionStatus"],
					};
				}

				// Description items (have descriptionId and term)
				if ("descriptionId" in s && "term" in s) {
					return {
						tableName: "descriptions",
						indexes: ["conceptId", "term", "type", "active"],
					};
				}

				// Relationship items (have sourceId, destinationId, typeId)
				if ("sourceId" in s && "destinationId" in s && "typeId" in s) {
					return {
						tableName: "relationships",
						indexes: ["sourceId", "destinationId", "typeId", "active"],
					};
				}

				// Reference set members (have memberId and refsetId)
				if ("memberId" in s && "refsetId" in s) {
					return {
						tableName: "refset_members",
						indexes: ["memberId", "refsetId", "referencedComponentId", "active"],
					};
				}

				// Browser concept children/parents (have conceptId and pt)
				if ("conceptId" in s && "pt" in s) {
					return {
						tableName: "concepts",
						indexes: ["conceptId", "active", "definitionStatus"],
					};
				}
			}
		}

		// Direct array responses (e.g., ancestors, children lists)
		if (Array.isArray(data)) {
			const sample = data[0];
			if (sample && typeof sample === "object") {
				const s = sample as Record<string, unknown>;

				if ("conceptId" in s) {
					return {
						tableName: "concepts",
						indexes: ["conceptId", "active", "definitionStatus"],
					};
				}

				if ("sourceId" in s && "destinationId" in s) {
					return {
						tableName: "relationships",
						indexes: ["sourceId", "destinationId", "typeId"],
					};
				}
			}
		}

		return undefined;
	}
}
