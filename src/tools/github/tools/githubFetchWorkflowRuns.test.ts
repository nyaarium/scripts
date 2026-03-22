import { describe, expect, it } from "bun:test";
import { githubFetchWorkflowRuns, transformRuns } from "./githubFetchWorkflowRuns.ts";

describe("transformRuns", () => {
	it("transforms a single run", () => {
		const result = transformRuns([
			{
				databaseId: 123,
				displayTitle: "Build",
				workflowName: "CI",
				event: "push",
				status: "completed",
				conclusion: "success",
				headBranch: "main",
				headSha: "abc123",
				url: "https://github.com/owner/repo/actions/runs/123",
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:05:00Z",
				attempt: 1,
			},
		]);
		expect(result).toHaveLength(1);
		expect(result[0].databaseId).toBe(123);
		expect(result[0].conclusion).toBe("success");
		expect(result[0].workflowName).toBe("CI");
	});

	it("handles null conclusion (in-progress run)", () => {
		const result = transformRuns([
			{
				databaseId: 456,
				displayTitle: "Test",
				workflowName: "CI",
				event: "pull_request",
				status: "in_progress",
				conclusion: null,
				headBranch: "feature",
				headSha: "def456",
				url: "https://example.com",
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				attempt: 1,
			},
		]);
		expect(result[0].conclusion).toBeNull();
		expect(result[0].status).toBe("in_progress");
	});

	it("handles missing optional fields with defaults", () => {
		const result = transformRuns([
			{
				databaseId: 789,
				displayTitle: "Deploy",
				workflowName: "",
				event: "push",
				status: "completed",
				conclusion: null,
				headBranch: "main",
				headSha: "ghi789",
				url: "https://example.com",
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				attempt: 1,
			},
		]);
		expect(result[0].workflowName).toBe("");
		expect(result[0].attempt).toBe(1);
		expect(result[0].conclusion).toBeNull();
	});

	it("transforms multiple runs", () => {
		const runs = [
			{
				databaseId: 1,
				displayTitle: "A",
				workflowName: "CI",
				event: "push",
				status: "completed",
				conclusion: "success",
				headBranch: "main",
				headSha: "a1",
				url: "https://example.com/1",
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				attempt: 1,
			},
			{
				databaseId: 2,
				displayTitle: "B",
				workflowName: "CI",
				event: "push",
				status: "completed",
				conclusion: "failure",
				headBranch: "main",
				headSha: "b2",
				url: "https://example.com/2",
				createdAt: "2024-01-02T00:00:00Z",
				updatedAt: "2024-01-02T00:00:00Z",
				attempt: 1,
			},
		];
		const result = transformRuns(runs);
		expect(result).toHaveLength(2);
		expect(result[0].conclusion).toBe("success");
		expect(result[1].conclusion).toBe("failure");
	});

	it("handles empty array", () => {
		expect(transformRuns([])).toEqual([]);
	});
});

describe("githubFetchWorkflowRuns schema", () => {
	const schema = githubFetchWorkflowRuns.schema;

	it("requires branch", () => {
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("accepts branch only", () => {
		const result = schema.safeParse({ branch: "main" });
		expect(result.success).toBe(true);
	});

	it("defaults limit to 20", () => {
		const result = schema.safeParse({ branch: "main" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.limit).toBe(20);
	});

	it("accepts valid status filter", () => {
		expect(schema.safeParse({ branch: "main", status: "success" }).success).toBe(true);
		expect(schema.safeParse({ branch: "main", status: "failure" }).success).toBe(true);
		expect(schema.safeParse({ branch: "main", status: "in_progress" }).success).toBe(true);
	});

	it("rejects invalid status", () => {
		expect(schema.safeParse({ branch: "main", status: "bad" }).success).toBe(false);
	});

	it("rejects limit above 100", () => {
		expect(schema.safeParse({ branch: "main", limit: 101 }).success).toBe(false);
	});
});
