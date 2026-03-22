import { describe, expect, it } from "bun:test";
import { githubAwaitWorkflowRun, isTerminalStatus } from "./githubAwaitWorkflowRun.ts";

describe("isTerminalStatus", () => {
	it("returns true for completed", () => {
		expect(isTerminalStatus("completed")).toBe(true);
	});

	it("returns false for in_progress", () => {
		expect(isTerminalStatus("in_progress")).toBe(false);
	});

	it("returns false for queued", () => {
		expect(isTerminalStatus("queued")).toBe(false);
	});

	it("returns false for waiting", () => {
		expect(isTerminalStatus("waiting")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isTerminalStatus("")).toBe(false);
	});
});

describe("githubAwaitWorkflowRun schema", () => {
	const schema = githubAwaitWorkflowRun.schema;

	it("requires runId", () => {
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("accepts runId only", () => {
		expect(schema.safeParse({ runId: "123" }).success).toBe(true);
	});

	it("defaults pollIntervalSeconds to 30", () => {
		const result = schema.safeParse({ runId: "123" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.pollIntervalSeconds).toBe(30);
	});

	it("defaults maxWaitSeconds to 1800", () => {
		const result = schema.safeParse({ runId: "123" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.maxWaitSeconds).toBe(1800);
	});

	it("rejects pollIntervalSeconds below 10", () => {
		expect(schema.safeParse({ runId: "123", pollIntervalSeconds: 5 }).success).toBe(false);
	});

	it("rejects maxWaitSeconds above 7200", () => {
		expect(schema.safeParse({ runId: "123", maxWaitSeconds: 8000 }).success).toBe(false);
	});
});
