import { describe, expect, it } from "bun:test";
import type { z } from "zod";
import { type InputIssueSchema, transformIssue } from "./githubFetchIssue.ts";

type InputIssue = z.infer<typeof InputIssueSchema>;

function makeIssue(overrides: Partial<InputIssue> = {}): InputIssue {
	return {
		number: 1,
		title: "Test issue",
		body: "Issue body",
		state: "OPEN",
		stateReason: null,
		author: { login: "alice", name: "Alice" },
		assignees: [],
		labels: [],
		comments: [],
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
		closedAt: null,
		...overrides,
	};
}

describe("transformIssue", () => {
	it("transforms basic issue", () => {
		const result = transformIssue(makeIssue());
		expect(result.number).toBe(1);
		expect(result.title).toBe("Test issue");
		expect(result.author).toBe("Alice");
		expect(result.state).toBe("OPEN");
	});

	it("falls back to login when name is null", () => {
		const result = transformIssue(makeIssue({ author: { login: "bot", name: null } }));
		expect(result.author).toBe("bot");
	});

	it("transforms assignees to string array", () => {
		const result = transformIssue(
			makeIssue({
				assignees: [
					{ login: "alice", name: "Alice" },
					{ login: "bob", name: null },
				],
			}),
		);
		expect(result.assignees).toEqual(["Alice", "bob"]);
	});

	it("transforms labels to string array", () => {
		const result = transformIssue(
			makeIssue({
				labels: [{ name: "bug", description: "Bug report", color: "red" }, { name: "urgent" }],
			}),
		);
		expect(result.labels).toEqual(["bug", "urgent"]);
	});

	it("transforms comments", () => {
		const result = transformIssue(
			makeIssue({
				comments: [
					{
						id: "c1",
						author: { login: "alice", name: "Alice" },
						body: "Hello",
						createdAt: "2024-01-01T00:00:00Z",
						updatedAt: null,
					},
				],
			}),
		);
		expect(result.comments).toHaveLength(1);
		expect(result.comments[0].author.login).toBe("alice");
		expect(result.comments[0].body).toBe("Hello");
	});

	it("handles null body", () => {
		const result = transformIssue(makeIssue({ body: null }));
		expect(result.body).toBeNull();
	});

	it("handles null closedAt", () => {
		const result = transformIssue(makeIssue({ closedAt: null }));
		expect(result.closedAt).toBeNull();
	});

	it("handles closedAt with value", () => {
		const result = transformIssue(makeIssue({ closedAt: "2024-01-03T00:00:00Z" }));
		expect(result.closedAt).toBe("2024-01-03T00:00:00Z");
	});

	it("defaults isPinned to false", () => {
		const result = transformIssue(makeIssue());
		expect(result.isPinned).toBe(false);
	});

	it("preserves isPinned when true", () => {
		const result = transformIssue(makeIssue({ isPinned: true }));
		expect(result.isPinned).toBe(true);
	});
});

describe("githubFetchIssue schema", () => {
	const { githubFetchIssue } = require("./githubFetchIssue.ts");
	const schema = githubFetchIssue.schema;

	it("accepts minimal input with issueId", () => {
		expect(schema.safeParse({ issueId: "42" }).success).toBe(true);
	});

	it("accepts list mode without issueId", () => {
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("defaults state to all", () => {
		const result = schema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.state).toBe("all");
	});

	it("defaults limit to 20", () => {
		const result = schema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.limit).toBe(20);
	});

	it("rejects limit above 100", () => {
		expect(schema.safeParse({ limit: 101 }).success).toBe(false);
	});

	it("rejects invalid state", () => {
		expect(schema.safeParse({ state: "invalid" }).success).toBe(false);
	});
});
