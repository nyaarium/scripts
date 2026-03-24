import { describe, expect, it } from "bun:test";
import { gitCleanupBranches, parseBranchOutput } from "./gitCleanupBranches.ts";

describe("parseBranchOutput", () => {
	it("parses a branch with gone remote", () => {
		const output = "old-branch|origin/old-branch|[gone]";
		const result = parseBranchOutput(output);
		expect(result).toEqual([{ name: "old-branch", upstream: "origin/old-branch", track: "[gone]" }]);
	});

	it("parses a branch ahead of remote", () => {
		const output = "feature|origin/feature|[ahead 2]";
		const result = parseBranchOutput(output);
		expect(result).toEqual([{ name: "feature", upstream: "origin/feature", track: "[ahead 2]" }]);
	});

	it("parses a local-only branch (no upstream)", () => {
		const output = "local-only||";
		const result = parseBranchOutput(output);
		expect(result).toEqual([{ name: "local-only", upstream: "", track: "" }]);
	});

	it("parses a clean tracked branch with no ahead/behind", () => {
		const output = "main|origin/main|";
		const result = parseBranchOutput(output);
		expect(result).toEqual([{ name: "main", upstream: "origin/main", track: "" }]);
	});

	it("parses multiple branches", () => {
		const output = [
			"main|origin/main|",
			"feature|origin/feature|[ahead 2]",
			"old-branch|origin/old-branch|[gone]",
			"local-only||",
		].join("\n");

		const result = parseBranchOutput(output);
		expect(result).toHaveLength(4);
		expect(result[0]).toEqual({ name: "main", upstream: "origin/main", track: "" });
		expect(result[1]).toEqual({ name: "feature", upstream: "origin/feature", track: "[ahead 2]" });
		expect(result[2]).toEqual({ name: "old-branch", upstream: "origin/old-branch", track: "[gone]" });
		expect(result[3]).toEqual({ name: "local-only", upstream: "", track: "" });
	});

	it("handles empty input", () => {
		expect(parseBranchOutput("")).toEqual([]);
	});

	it("skips blank lines", () => {
		const output = "main|origin/main|\n\n\nlocal-only||";
		const result = parseBranchOutput(output);
		expect(result).toHaveLength(2);
	});

	it("parses branch with ahead and behind", () => {
		const output = "diverged|origin/diverged|[ahead 1, behind 3]";
		const result = parseBranchOutput(output);
		expect(result).toEqual([{ name: "diverged", upstream: "origin/diverged", track: "[ahead 1, behind 3]" }]);
	});
});

describe("gitCleanupBranches schema", () => {
	const schema = gitCleanupBranches.schema;

	it("accepts empty input", () => {
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("accepts dryRun", () => {
		expect(schema.safeParse({ dryRun: true }).success).toBe(true);
	});

	it("accepts repo parameter", () => {
		expect(schema.safeParse({ repo: "owner/repo" }).success).toBe(true);
	});

	it("dryRun is undefined when not provided", () => {
		const result = schema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.dryRun).toBeUndefined();
	});
});
