import { describe, expect, it } from "bun:test";
import { gitStatus, parseStatusOutput } from "./gitStatus.ts";

describe("parseStatusOutput", () => {
	it("parses branch and upstream info", () => {
		const output = [
			"# branch.oid abc123",
			"# branch.head main",
			"# branch.upstream origin/main",
			"# branch.ab +2 -1",
		].join("\n");
		const result = parseStatusOutput(output);
		expect(result.branch).toBe("main");
		expect(result.upstream).toBe("origin/main");
		expect(result.ahead).toBe(2);
		expect(result.behind).toBe(1);
	});

	it("parses staged files", () => {
		const output = ["# branch.head main", "1 M. N... 100644 100644 100644 abc123 def456 src/file.ts"].join("\n");
		const result = parseStatusOutput(output);
		expect(result.staged).toEqual([{ path: "src/file.ts", status: "modified" }]);
		expect(result.unstaged).toEqual([]);
	});

	it("parses unstaged files", () => {
		const output = ["# branch.head main", "1 .M N... 100644 100644 100644 abc123 def456 src/file.ts"].join("\n");
		const result = parseStatusOutput(output);
		expect(result.staged).toEqual([]);
		expect(result.unstaged).toEqual([{ path: "src/file.ts", status: "modified" }]);
	});

	it("parses both staged and unstaged for same file", () => {
		const output = ["# branch.head main", "1 MM N... 100644 100644 100644 abc123 def456 src/file.ts"].join("\n");
		const result = parseStatusOutput(output);
		expect(result.staged).toEqual([{ path: "src/file.ts", status: "modified" }]);
		expect(result.unstaged).toEqual([{ path: "src/file.ts", status: "modified" }]);
	});

	it("parses untracked files", () => {
		const output = ["# branch.head main", "? new-file.ts", "? another.ts"].join("\n");
		const result = parseStatusOutput(output);
		expect(result.untracked).toEqual(["new-file.ts", "another.ts"]);
	});

	it("parses added files", () => {
		const output = ["# branch.head main", "1 A. N... 000000 100644 100644 0000000 abc1234 new-file.ts"].join("\n");
		const result = parseStatusOutput(output);
		expect(result.staged).toEqual([{ path: "new-file.ts", status: "added" }]);
	});

	it("parses deleted files", () => {
		const output = ["# branch.head main", "1 D. N... 100644 000000 000000 abc1234 0000000 old-file.ts"].join("\n");
		const result = parseStatusOutput(output);
		expect(result.staged).toEqual([{ path: "old-file.ts", status: "deleted" }]);
	});

	it("handles no upstream", () => {
		const output = "# branch.head feature-branch";
		const result = parseStatusOutput(output);
		expect(result.branch).toBe("feature-branch");
		expect(result.upstream).toBeNull();
		expect(result.ahead).toBe(0);
		expect(result.behind).toBe(0);
	});

	it("handles clean working tree", () => {
		const output = ["# branch.head main", "# branch.upstream origin/main", "# branch.ab +0 -0"].join("\n");
		const result = parseStatusOutput(output);
		expect(result.staged).toEqual([]);
		expect(result.unstaged).toEqual([]);
		expect(result.untracked).toEqual([]);
	});

	it("handles empty output", () => {
		const result = parseStatusOutput("");
		expect(result.branch).toBe("");
		expect(result.upstream).toBeNull();
		expect(result.staged).toEqual([]);
		expect(result.unstaged).toEqual([]);
		expect(result.untracked).toEqual([]);
	});

	it("parses rename entry", () => {
		const output = [
			"# branch.head main",
			"2 R. N... 100644 100644 100644 abc123 def456 R100\tnew-name.ts\told-name.ts",
		].join("\n");
		const result = parseStatusOutput(output);
		expect(result.staged).toEqual([{ path: "new-name.ts", status: "renamed" }]);
	});

	it("parses mixed changes", () => {
		const output = [
			"# branch.head feature",
			"# branch.upstream origin/feature",
			"# branch.ab +3 -0",
			"1 M. N... 100644 100644 100644 abc123 def456 src/modified-staged.ts",
			"1 .M N... 100644 100644 100644 abc123 def456 src/modified-unstaged.ts",
			"1 A. N... 000000 100644 100644 0000000 abc123 src/new-file.ts",
			"1 D. N... 100644 000000 000000 abc123 0000000 src/deleted.ts",
			"? untracked.ts",
		].join("\n");
		const result = parseStatusOutput(output);
		expect(result.branch).toBe("feature");
		expect(result.upstream).toBe("origin/feature");
		expect(result.ahead).toBe(3);
		expect(result.behind).toBe(0);
		expect(result.staged).toHaveLength(3);
		expect(result.unstaged).toHaveLength(1);
		expect(result.untracked).toEqual(["untracked.ts"]);
	});
});

describe("gitStatus schema", () => {
	const schema = gitStatus.schema;

	it("accepts empty input", () => {
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("accepts repo parameter", () => {
		expect(schema.safeParse({ repo: "owner/repo" }).success).toBe(true);
	});
});
