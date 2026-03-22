import { describe, expect, it } from "bun:test";
import { githubFetchWorkflowRun, transformRunDetail } from "./githubFetchWorkflowRun.ts";

describe("transformRunDetail", () => {
	const baseRun = {
		databaseId: 100,
		displayTitle: "CI Build",
		workflowName: "CI",
		event: "push",
		status: "completed",
		conclusion: "success",
		headBranch: "main",
		headSha: "abc123",
		url: "https://example.com/runs/100",
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:05:00Z",
		attempt: 1,
		jobs: [],
	};

	it("transforms a run with no jobs", () => {
		const result = transformRunDetail(baseRun);
		expect(result.databaseId).toBe(100);
		expect(result.jobs).toEqual([]);
		expect(result.conclusion).toBe("success");
	});

	it("transforms a run with jobs and steps", () => {
		const result = transformRunDetail({
			...baseRun,
			jobs: [
				{
					databaseId: 200,
					name: "build",
					status: "completed",
					conclusion: "success",
					startedAt: "2024-01-01T00:00:10Z",
					completedAt: "2024-01-01T00:03:00Z",
					url: "https://example.com/jobs/200",
					steps: [
						{ name: "Checkout", status: "completed", conclusion: "success", number: 1 },
						{ name: "Build", status: "completed", conclusion: "success", number: 2 },
					],
				},
			],
		});
		expect(result.jobs).toHaveLength(1);
		expect(result.jobs[0].name).toBe("build");
		expect(result.jobs[0].steps).toHaveLength(2);
		expect(result.jobs[0].steps[0].name).toBe("Checkout");
	});

	it("handles null conclusion on job", () => {
		const result = transformRunDetail({
			...baseRun,
			status: "in_progress",
			conclusion: null,
			jobs: [
				{
					databaseId: 300,
					name: "test",
					status: "in_progress",
					conclusion: null,
					startedAt: "2024-01-01T00:00:00Z",
					completedAt: null,
					url: "",
					steps: [],
				},
			],
		});
		expect(result.conclusion).toBeNull();
		expect(result.jobs[0].conclusion).toBeNull();
		expect(result.jobs[0].completedAt).toBeNull();
	});

	it("handles missing optional fields with defaults", () => {
		const result = transformRunDetail({
			databaseId: 400,
			displayTitle: "Deploy",
			workflowName: "",
			event: "push",
			status: "completed",
			conclusion: null,
			headBranch: "main",
			headSha: "xyz",
			url: "https://example.com",
			createdAt: "2024-01-01T00:00:00Z",
			updatedAt: "2024-01-01T00:00:00Z",
			attempt: 1,
			jobs: [],
		});
		expect(result.workflowName).toBe("");
		expect(result.attempt).toBe(1);
		expect(result.jobs).toEqual([]);
	});

	it("transforms multiple jobs", () => {
		const result = transformRunDetail({
			...baseRun,
			jobs: [
				{
					databaseId: 501,
					name: "lint",
					status: "completed",
					conclusion: "success",
					startedAt: null,
					completedAt: null,
					url: "",
					steps: [],
				},
				{
					databaseId: 502,
					name: "test",
					status: "completed",
					conclusion: "failure",
					startedAt: null,
					completedAt: null,
					url: "",
					steps: [{ name: "Run tests", status: "completed", conclusion: "failure", number: 1 }],
				},
			],
		});
		expect(result.jobs).toHaveLength(2);
		expect(result.jobs[0].name).toBe("lint");
		expect(result.jobs[1].conclusion).toBe("failure");
		expect(result.jobs[1].steps[0].conclusion).toBe("failure");
	});
});

describe("githubFetchWorkflowRun schema", () => {
	const schema = githubFetchWorkflowRun.schema;

	it("requires runId", () => {
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("accepts runId only", () => {
		expect(schema.safeParse({ runId: "123" }).success).toBe(true);
	});

	it("accepts runId with jobName", () => {
		expect(schema.safeParse({ runId: "123", jobName: "build" }).success).toBe(true);
	});

	it("accepts runId with repo", () => {
		expect(schema.safeParse({ runId: "123", repo: "owner/repo" }).success).toBe(true);
	});
});
