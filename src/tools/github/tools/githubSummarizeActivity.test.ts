import { describe, expect, it } from "bun:test";
import { githubSummarizeActivity } from "./githubSummarizeActivity.ts";

const schema = githubSummarizeActivity.schema;

describe("githubSummarizeActivity schema", () => {
	it("accepts valid days and no author", () => {
		const result = schema.safeParse({ days: 7 });
		expect(result.success).toBe(true);
	});

	it("accepts valid days with author", () => {
		const result = schema.safeParse({ days: 30, author: "Alice" });
		expect(result.success).toBe(true);
	});

	it("rejects missing days", () => {
		const result = schema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("rejects days below minimum (0)", () => {
		const result = schema.safeParse({ days: 0 });
		expect(result.success).toBe(false);
	});

	it("rejects days above maximum (366)", () => {
		const result = schema.safeParse({ days: 366 });
		expect(result.success).toBe(false);
	});

	it("rejects non-integer days", () => {
		const result = schema.safeParse({ days: 7.5 });
		expect(result.success).toBe(false);
	});

	it("allows author to be omitted", () => {
		const result = schema.safeParse({ days: 14 });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.author).toBeUndefined();
	});

	it("accepts boundary values 1 and 365", () => {
		expect(schema.safeParse({ days: 1 }).success).toBe(true);
		expect(schema.safeParse({ days: 365 }).success).toBe(true);
	});

	it("accepts repo parameter", () => {
		const result = schema.safeParse({ days: 7, repo: "owner/repo" });
		expect(result.success).toBe(true);
	});
});
