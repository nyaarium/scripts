import { describe, expect, it } from "bun:test";
import { githubRerunWorkflow } from "./githubRerunWorkflow.ts";

describe("githubRerunWorkflow schema", () => {
	const schema = githubRerunWorkflow.schema;

	it("requires runId", () => {
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("accepts runId only", () => {
		expect(schema.safeParse({ runId: "123" }).success).toBe(true);
	});

	it("defaults onlyFailed to false", () => {
		const result = schema.safeParse({ runId: "123" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.onlyFailed).toBe(false);
	});

	it("defaults dryRun to false", () => {
		const result = schema.safeParse({ runId: "123" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.dryRun).toBe(false);
	});

	it("accepts all params", () => {
		const result = schema.safeParse({ runId: "123", onlyFailed: true, dryRun: true, repo: "owner/repo" });
		expect(result.success).toBe(true);
	});
});
