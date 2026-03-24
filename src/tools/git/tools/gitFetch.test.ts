import { describe, expect, it } from "bun:test";
import { gitFetch, parseFetchOutput } from "./gitFetch.ts";

describe("parseFetchOutput", () => {
	it("parses empty fetch (no updates)", () => {
		const result = parseFetchOutput("");
		expect(result.success).toBe(true);
		expect(result.updates).toEqual([]);
	});

	it("parses remote URL", () => {
		const stderr = "From github.com:user/repo";
		const result = parseFetchOutput(stderr);
		expect(result.remote).toBe("github.com:user/repo");
	});

	it("parses pruned branch", () => {
		const stderr = ["From github.com:user/repo", " x [deleted]         (none)     -> origin/old-branch"].join("\n");
		const result = parseFetchOutput(stderr);
		expect(result.updates).toEqual([{ action: "pruned", from: null, to: null, ref: "origin/old-branch" }]);
	});

	it("parses new branch", () => {
		const stderr = ["From github.com:user/repo", " * [new branch]      feature    -> origin/feature"].join("\n");
		const result = parseFetchOutput(stderr);
		expect(result.updates).toEqual([{ action: "new-branch", from: null, to: null, ref: "origin/feature" }]);
	});

	it("parses new tag", () => {
		const stderr = ["From github.com:user/repo", " * [new tag]         v1.0       -> v1.0"].join("\n");
		const result = parseFetchOutput(stderr);
		expect(result.updates).toEqual([{ action: "new-tag", from: null, to: null, ref: "v1.0" }]);
	});

	it("parses normal ref update", () => {
		const stderr = ["From github.com:user/repo", "   abc1234..def5678  main       -> origin/main"].join("\n");
		const result = parseFetchOutput(stderr);
		expect(result.updates).toEqual([{ action: "updated", from: "abc1234", to: "def5678", ref: "origin/main" }]);
	});

	it("parses forced update", () => {
		const stderr = [
			"From github.com:user/repo",
			" + abc1234...def5678 feature    -> origin/feature  (forced update)",
		].join("\n");
		const result = parseFetchOutput(stderr);
		expect(result.updates).toEqual([
			{ action: "forced-update", from: "abc1234", to: "def5678", ref: "origin/feature" },
		]);
	});

	it("parses mixed updates", () => {
		const stderr = [
			"From github.com:user/repo",
			" x [deleted]         (none)     -> origin/old-branch",
			" * [new branch]      feature    -> origin/feature",
			"   abc1234..def5678  main       -> origin/main",
		].join("\n");
		const result = parseFetchOutput(stderr);
		expect(result.updates).toHaveLength(3);
		expect(result.updates[0].action).toBe("pruned");
		expect(result.updates[1].action).toBe("new-branch");
		expect(result.updates[2].action).toBe("updated");
	});

	it("includes rawStderr", () => {
		const stderr = "From github.com:user/repo\nsome output";
		const result = parseFetchOutput(stderr);
		expect(result.rawStderr).toBe(stderr);
	});
});

describe("gitFetch schema", () => {
	const schema = gitFetch.schema;

	it("accepts empty input", () => {
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("accepts repo parameter", () => {
		expect(schema.safeParse({ repoPath: "/workspace/nyaascripts" }).success).toBe(true);
	});
});
